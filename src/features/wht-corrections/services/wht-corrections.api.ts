import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { desc, eq, ilike, inArray, notInArray, or, sql, sum } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "@/drizzle/db";
import {
	bills,
	vendors,
	vwWhtBalances,
	whtCorrectionLines,
	whtCorrections,
} from "@/drizzle/schema";
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
import { createBankingEntry, deleteBankingEntry } from "@/services/banking";
import {
	areJournalValuesBalanced,
	createJournalEntry,
	deleteJournalEntry,
	getCashEquivalentAccountId,
} from "@/services/journal";
import { resolveAccountRole } from "@/services/ledger-account-mappings";

const JOURNAL_SOURCE = "wht correction";

/**
 * Thrown inside the transaction so a failed balance check rolls the whole
 * deletion back, then unwrapped by the catch below into a ValidationError
 * carrying its own message rather than a generic one. Mirrors
 * `RemittanceValidationError` in the sibling wht-remittances service.
 */
class CorrectionDeletionError extends Error {}

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
			.orderBy(desc(bills.invoiceDate));
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

			// Every correction debits accounts_payable, never a user-chosen
			// account: the original bill posted CR accounts_payable for the
			// full pre-correction amount, so the correction always brings that
			// recorded payable back down to what's actually owed.
			let accountsPayableId: number;
			try {
				accountsPayableId = await resolveAccountRole("accounts_payable");
			} catch (error) {
				return failure({
					type: "ValidationError",
					message:
						error instanceof Error
							? error.message
							: "Could not resolve the accounts payable account",
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
				try {
					creditAccountId = await resolveAccountRole("wht_payable");
				} catch (error) {
					return failure({
						type: "ValidationError",
						message:
							error instanceof Error
								? error.message
								: "Could not resolve the WHT payable account",
					});
				}
				journalDate = correctionDate;
			}

			const journalLines = buildCorrectionJournalLines({
				debitAccountId: accountsPayableId,
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

export const deleteCorrection = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(z.string().min(1, { error: "Correction id is not valid" }))
	.handler(
		async ({
			data: correctionId,
			context: {
				user: { id: userId },
			},
		}) => {
			await requirePermission("wht-corrections:delete");

			try {
				const correction = await db.query.whtCorrections.findFirst({
					columns: { id: true, correctionNo: true, remittanceStatus: true },
					where: eq(whtCorrections.id, correctionId),
				});

				if (!correction) {
					return failure({
						type: "NotFoundError",
						message: "Correction not found",
					});
				}

				await db.transaction(async (tx) => {
					// A pending correction adds to vw_wht_balances.wht_balance, which a
					// remittance may already have consumed. Deleting it out from under
					// a remittance would strand that remittance's debit and drive the
					// balance negative, so refuse when that would happen. Mirrors the
					// analogous guard in bills.api.ts's upsertBill.
					if (correction.remittanceStatus === "pending") {
						const lines = await tx.query.whtCorrectionLines.findMany({
							where: eq(whtCorrectionLines.correctionId, correctionId),
						});

						for (const line of lines) {
							await tx.execute(
								sql`SELECT id FROM bills WHERE id = ${line.billId} FOR UPDATE`,
							);

							const [balance] = await tx
								.select({ whtBalance: vwWhtBalances.whtBalance })
								.from(vwWhtBalances)
								.where(eq(vwWhtBalances.id, line.billId));

							if (
								balance &&
								Number(balance.whtBalance) - Number(line.amount) < 0
							) {
								throw new CorrectionDeletionError(
									"Deleting this correction would leave more WHT remitted than owed on a bill it covers. Delete the affected remittance first.",
								);
							}
						}
					}

					// Lines cascade with the header, which restores every affected
					// bill's net_payable/wht_balance on the next read.
					await tx
						.delete(whtCorrections)
						.where(eq(whtCorrections.id, correctionId));
					await deleteJournalEntry({
						source: JOURNAL_SOURCE,
						sourceId: correctionId,
						tx,
					});
					await deleteBankingEntry({
						source: JOURNAL_SOURCE,
						sourceId: correctionId,
						tx,
					});
				});

				await logActivity({
					data: {
						action: "delete wht correction",
						userId,
						description: `Deleted WHT correction no ${correction.correctionNo}`,
					},
				});

				return success(undefined);
			} catch (error) {
				if (error instanceof CorrectionDeletionError) {
					return failure({
						type: "ValidationError",
						message: error.message,
					});
				}

				console.error(error);
				return failure({
					type: "ApplicationError",
					message: "Failed to delete WHT correction",
				});
			}
		},
	);
