import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { desc, eq, ilike, inArray, notInArray, or, sql, sum } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "@/drizzle/db";
import {
	bills,
	ledgerAccounts,
	vendors,
	whtCorrectionLines,
	whtCorrections,
} from "@/drizzle/schema";
import { findInvalidPostingAccountIdsByType } from "@/features/coa/services/account-option-filter";
import {
	buildCorrectionJournalLines,
	sumCorrectionLines,
} from "@/features/wht-corrections/lib/correction-totals";
import { correctionFormSchema } from "@/features/wht-corrections/services/schemas";
import { requirePermission } from "@/lib/permissions/permissions";
import { failure, success } from "@/lib/result";
import { searchValidateSchema } from "@/lib/schema-rules";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { logActivity } from "@/services/activity-logger";
import { createBankingEntry } from "@/services/banking";
import {
	areJournalValuesBalanced,
	createJournalEntry,
	getCashEquivalentAccountId,
} from "@/services/journal";
import { resolveAccountRole } from "@/services/ledger-account-mappings";

const JOURNAL_SOURCE = "wht correction";

export const getCorrectionNo = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		const result = await db.execute<{ correctionNo: number }>(
			`SELECT COALESCE(MAX(correction_no), 0) as "correctionNo" FROM wht_corrections`,
		);
		return (result.rows[0]?.correctionNo ?? 0) + 1;
	});

/**
 * Bills a correction line can reference: any non-draft, non-cancelled bill,
 * across every vendor. Unlike the WHT remittance picker this is not scoped
 * to bills with an outstanding WHT balance — a correction targets a bill
 * that may have withheld nothing at all, which is the whole point.
 */
export const getCorrectableBills = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		await requirePermission("wht-corrections:create");

		return db
			.select({
				id: bills.id,
				invoiceNo: bills.invoiceNo,
				invoiceDate: bills.invoiceDate,
				vendorName: vendors.name,
			})
			.from(bills)
			.innerJoin(vendors, eq(bills.vendorId, vendors.id))
			.where(notInArray(bills.status, ["draft", "cancelled"]))
			.orderBy(desc(bills.invoiceDate))
			.limit(500);
	});

/**
 * Soft duplicate-warning check: which of the given bills already has a
 * correction line on some other correction. Never blocks submission — the
 * form shows this as a banner, not a validation error.
 */
export const getExistingCorrectionsForBills = createServerFn()
	.middleware([authMiddleware])
	.validator(z.array(z.string()))
	.handler(async ({ data: billIds }) => {
		await requirePermission("wht-corrections:create");

		if (billIds.length === 0) return [];

		return db
			.select({
				billId: whtCorrectionLines.billId,
				correctionNo: whtCorrections.correctionNo,
			})
			.from(whtCorrectionLines)
			.innerJoin(
				whtCorrections,
				eq(whtCorrectionLines.correctionId, whtCorrections.id),
			)
			.where(inArray(whtCorrectionLines.billId, billIds));
	});

export const getCorrections = createServerFn()
	.middleware([authMiddleware])
	.validator(searchValidateSchema)
	.handler(async ({ data: { q } }) => {
		await requirePermission("wht-corrections:view");

		return db
			.select({
				id: whtCorrections.id,
				correctionNo: whtCorrections.correctionNo,
				correctionDate: whtCorrections.correctionDate,
				remittanceStatus: whtCorrections.remittanceStatus,
				memo: whtCorrections.memo,
				amount: sum(whtCorrectionLines.amount),
			})
			.from(whtCorrections)
			.where(
				q
					? or(
							ilike(sql`${whtCorrections.correctionNo}::text`, `%${q}%`),
							ilike(whtCorrections.memo, `%${q}%`),
						)
					: undefined,
			)
			.leftJoin(
				whtCorrectionLines,
				eq(whtCorrections.id, whtCorrectionLines.correctionId),
			)
			.groupBy(
				whtCorrections.id,
				whtCorrections.correctionNo,
				whtCorrections.correctionDate,
				whtCorrections.remittanceStatus,
				whtCorrections.memo,
			)
			.orderBy(desc(whtCorrections.correctionNo))
			.limit(100);
	});

export const getCorrection = createServerFn()
	.middleware([authMiddleware])
	.validator(z.string().min(1, { error: "Correction id is not valid" }))
	.handler(async ({ data: correctionId }) => {
		await requirePermission("wht-corrections:view");

		const correction = await db.query.whtCorrections.findFirst({
			where: eq(whtCorrections.id, correctionId),
			with: {
				bank: { columns: { id: true, bankName: true } },
				treatmentAccount: { columns: { id: true, name: true } },
				lines: {
					orderBy: (t, { asc }) => asc(t.lineNumber),
					with: {
						bill: {
							columns: { id: true, invoiceDate: true, invoiceNo: true },
							with: {
								vendor: { columns: { id: true, name: true, taxPin: true } },
							},
						},
					},
				},
			},
		});

		if (!correction) {
			throw notFound();
		}

		return correction;
	});

export const createCorrection = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(correctionFormSchema)
	.handler(
		async ({
			data,
			context: {
				user: { id: userId },
			},
		}) => {
			await requirePermission("wht-corrections:create");

			const {
				correctionDate,
				treatmentAccountId,
				remittanceStatus,
				remittanceDate,
				paymentMethod,
				bankId,
				cashEquivalentAccountId,
				memo,
				lines,
			} = data;

			if (lines.length === 0) {
				return failure({
					type: "ValidationError",
					message: "At least one line is required",
				});
			}

			const total = sumCorrectionLines(lines);

			if (total <= 0) {
				return failure({
					type: "ValidationError",
					message: "Correction amount must be greater than zero",
				});
			}

			const treatmentAccountIdNum = Number(treatmentAccountId);
			const selectableAccounts = await db.query.ledgerAccounts.findMany({
				columns: {
					id: true,
					name: true,
					type: true,
					isActive: true,
					isPosting: true,
					parentId: true,
				},
				where: inArray(ledgerAccounts.id, [treatmentAccountIdNum]),
			});

			const invalidAccountIds = findInvalidPostingAccountIdsByType(
				selectableAccounts,
				[treatmentAccountIdNum],
				["expense", "asset"],
			);

			if (invalidAccountIds.length > 0) {
				return failure({
					type: "ValidationError",
					message:
						"Treatment account must be an active posting asset or expense account.",
				});
			}

			let creditAccountId: number;
			let journalDate: string;
			let resolvedBankId: string | null = null;

			if (remittanceStatus === "already_remitted") {
				if (!remittanceDate) {
					return failure({
						type: "ValidationError",
						message: "Remittance date is required",
					});
				}

				// Zod's superRefine already requires this on the client, but the
				// field stays nullable in CorrectionFormValues, so this guard both
				// narrows the type for getCashEquivalentAccountId and re-checks the
				// invariant server-side, same as the rest of this handler's fields.
				if (!paymentMethod) {
					return failure({
						type: "ValidationError",
						message: "Payment method is required",
					});
				}

				try {
					creditAccountId = await getCashEquivalentAccountId({
						paymentMethod,
						bankId,
						creditingAccountId: cashEquivalentAccountId,
					});
				} catch (error) {
					return failure({
						type: "ValidationError",
						message:
							error instanceof Error
								? error.message
								: "Could not resolve the crediting account",
					});
				}

				journalDate = remittanceDate;
				resolvedBankId =
					paymentMethod === "bank" || paymentMethod === "cheque"
						? (bankId ?? null)
						: null;
			} else {
				creditAccountId = await resolveAccountRole("wht_payable");
				journalDate = correctionDate;
			}

			const journalLines = buildCorrectionJournalLines({
				treatmentAccountId: treatmentAccountIdNum,
				creditAccountId,
				total,
				memo,
			});

			if (!areJournalValuesBalanced(journalLines)) {
				return failure({
					type: "ApplicationError",
					message: "Journal values are not balanced",
				});
			}

			const correctionNo = await getCorrectionNo();

			try {
				let correctionId = "";

				await db.transaction(async (tx) => {
					const [{ id: insertedId }] = await tx
						.insert(whtCorrections)
						.values({
							id: nanoid(),
							correctionNo,
							correctionDate,
							treatmentAccountId: treatmentAccountIdNum,
							remittanceStatus,
							remittanceDate:
								remittanceStatus === "already_remitted" ? remittanceDate : null,
							bankId: resolvedBankId,
							creditingAccountId: creditAccountId,
							memo,
							createdBy: userId,
						})
						.returning({ id: whtCorrections.id });

					correctionId = insertedId;

					await tx.insert(whtCorrectionLines).values(
						lines.map((line, index) => ({
							lineNumber: index + 1,
							correctionId,
							billId: line.billId,
							whtCategory: line.whtCategory,
							whtRate: line.whtRate.toString(),
							amount: line.amount.toString(),
						})),
					);

					await createJournalEntry({
						entry: {
							source: JOURNAL_SOURCE,
							sourceId: correctionId,
							entryDate: journalDate,
							description: memo || `WHT correction no ${correctionNo}`,
						},
						lines: journalLines,
						tx,
					});

					if (remittanceStatus === "already_remitted" && resolvedBankId) {
						await createBankingEntry({
							entry: {
								source: JOURNAL_SOURCE,
								sourceId: correctionId,
								transactionDate: remittanceDate as string,
								dc: "credit",
								amount: total.toString(),
								reference: memo ?? `WHT correction no ${correctionNo}`,
								bankId: resolvedBankId,
							},
							tx,
						});
					}
				});

				await logActivity({
					data: {
						action: "create wht correction",
						userId,
						description: `Created WHT correction no ${correctionNo}`,
					},
				});

				return success(undefined);
			} catch (error) {
				console.error(error);
				return failure({
					type: "ApplicationError",
					message: "Failed to create WHT correction",
				});
			}
		},
	);
