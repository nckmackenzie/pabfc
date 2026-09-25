import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { asc, desc, eq, gt, ilike, or, sql, sum } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "@/drizzle/db";
import {
	vwWhtBalances,
	whtRemittanceLines,
	whtRemittances,
} from "@/drizzle/schema";
import { remittanceFormSchema } from "@/features/wht-remittances/services/schemas";
import { requirePermission } from "@/lib/permissions/permissions";
import { failure, success } from "@/lib/result";
import { searchValidateSchema } from "@/lib/schema-rules";
import { roundDecimal, toDecimalString } from "@/lib/helpers";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { logActivity } from "@/services/activity-logger";
import { resolveAccountRole } from "@/services/ledger-account-mappings";
import { createBankingEntry, deleteBankingEntry } from "@/services/banking";
import {
	areJournalValuesBalanced,
	createJournalEntry,
	deleteJournalEntry,
	getCashEquivalentAccountId,
} from "@/services/journal";

const JOURNAL_SOURCE = "wht remittance";

/**
 * Thrown inside the transaction so a failed balance check rolls the whole
 * remittance back, then unwrapped by the catch below into a ValidationError
 * carrying its own message rather than a generic one.
 */
class RemittanceValidationError extends Error {}

export const getRemittanceNo = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		const result = await db.execute<{ remittanceNo: number }>(
			`SELECT COALESCE(MAX(remittance_no), 0) as "remittanceNo" FROM wht_remittances`,
		);
		return (result.rows[0]?.remittanceNo ?? 0) + 1;
	});

export const getRemittances = createServerFn()
	.middleware([authMiddleware])
	.validator(searchValidateSchema)
	.handler(async ({ data: { q } }) => {
		await requirePermission("wht-remittances:view");

		return db
			.select({
				id: whtRemittances.id,
				remittanceNo: whtRemittances.remittanceNo,
				remittanceDate: whtRemittances.remittanceDate,
				reference: whtRemittances.reference,
				memo: whtRemittances.memo,
				amount: sum(whtRemittanceLines.amount),
			})
			.from(whtRemittances)
			.where(
				q
					? or(
							ilike(sql`${whtRemittances.remittanceNo}::text`, `%${q}%`),
							ilike(whtRemittances.reference, `%${q}%`),
							ilike(whtRemittances.memo, `%${q}%`),
						)
					: undefined,
			)
			.leftJoin(
				whtRemittanceLines,
				eq(whtRemittances.id, whtRemittanceLines.remittanceId),
			)
			.groupBy(
				whtRemittances.id,
				whtRemittances.remittanceNo,
				whtRemittances.remittanceDate,
				whtRemittances.reference,
				whtRemittances.memo,
			)
			.orderBy(desc(whtRemittances.remittanceNo))
			.limit(100);
	});

export const getRemittance = createServerFn()
	.middleware([authMiddleware])
	.validator(z.string().min(1, { error: "Remittance id is not valid" }))
	.handler(async ({ data: remittanceId }) => {
		await requirePermission("wht-remittances:view");

		const remittance = await db.query.whtRemittances.findFirst({
			columns: { bankId: false },
			where: eq(whtRemittances.id, remittanceId),
			with: {
				bank: { columns: { id: true, bankName: true } },
				lines: {
					orderBy: (t, { asc }) => asc(t.lineNumber),
					with: {
						bill: {
							columns: {
								id: true,
								invoiceDate: true,
								invoiceNo: true,
								total: true,
								whtAmount: true,
								whtCertificateNo: true,
								whtCertificateIssuedDate: true,
							},
							with: {
								// A remittance spans vendors, so each line names its own.
								vendor: { columns: { id: true, name: true, taxPin: true } },
							},
						},
					},
				},
			},
		});

		if (!remittance) {
			throw notFound();
		}

		return remittance;
	});

/**
 * Bills that still owe withholding tax to KRA. This is the remittance screen's
 * equivalent of `getUnpaidBillsBySupplier`, and reads from the view so the
 * balances cannot go stale.
 */
export const getOutstandingWhtBills = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		await requirePermission("wht-remittances:view");

		return db
			.select()
			.from(vwWhtBalances)
			.where(gt(vwWhtBalances.whtBalance, "0"))
			.orderBy(asc(vwWhtBalances.invoiceDate), asc(vwWhtBalances.invoiceNo));
	});

export const createRemittance = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(remittanceFormSchema)
	.handler(
		async ({
			data,
			context: {
				user: { id: userId },
			},
		}) => {
			await requirePermission(
				data.id ? "wht-remittances:update" : "wht-remittances:create",
			);

			const {
				id,
				bills,
				remittanceDate,
				paymentMethod,
				reference,
				bankId,
				memo,
				cashEquivalentAccountId,
			} = data;

			const remittedBills = bills.filter((bill) => bill.selected);

			if (remittedBills.length === 0) {
				return failure({
					type: "ApplicationError",
					message: "No bills selected",
				});
			}

			const remittanceNo = id
				? Number(data.remittanceNo)
				: await getRemittanceNo();

			const totalRemitted = roundDecimal(
				remittedBills.reduce(
					(acc, bill) => acc + Number(bill.amount ?? 0),
					0,
				),
			);

			if (totalRemitted <= 0) {
				return failure({
					type: "ValidationError",
					message: "Remittance amount must be greater than zero",
				});
			}

			let creditingAccountId: number;
			try {
				creditingAccountId = await getCashEquivalentAccountId({
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

			const whtPayableId = await resolveAccountRole("wht_payable");

			// Settles the liability raised when the bill was posted: the withheld tax
			// leaves the bank and the WHT Payable balance comes down by the same amount.
			const journalLines = [
				{
					accountId: whtPayableId,
					amount: totalRemitted.toString(),
					dc: "debit" as const,
					lineNumber: 1,
					memo,
				},
				{
					accountId: creditingAccountId,
					amount: totalRemitted.toString(),
					dc: "credit" as const,
					lineNumber: 2,
					memo,
				},
			];

			if (!areJournalValuesBalanced(journalLines)) {
				return failure({
					type: "ApplicationError",
					message: "Journal values are not balanced",
				});
			}

			try {
				await db.transaction(async (tx) => {
					const [{ id: remittanceId }] = await tx
						.insert(whtRemittances)
						.values({
							id: id ?? nanoid(),
							remittanceNo,
							remittanceDate,
							reference,
							bankId,
							creditingAccountId,
							createdBy: userId,
							memo,
						})
						.onConflictDoUpdate({
							target: whtRemittances.id,
							set: {
								remittanceDate,
								reference,
								bankId,
								creditingAccountId,
								createdBy: userId,
								memo,
							},
						})
						.returning({ id: whtRemittances.id });

					if (id) {
						await tx
							.delete(whtRemittanceLines)
							.where(eq(whtRemittanceLines.remittanceId, remittanceId));
						await deleteJournalEntry({
							source: JOURNAL_SOURCE,
							sourceId: remittanceId,
							tx,
						});
						await deleteBankingEntry({
							source: JOURNAL_SOURCE,
							sourceId: remittanceId,
							tx,
						});
					}

					// Balances are validated here rather than before the transaction, and
					// for updates as well as creates. On an update this runs after the
					// remittance's own lines have been deleted above, so the bill's
					// balance already excludes what this remittance previously claimed.
					//
					// Locking the bill row first serialises two remittances that touch the
					// same bill; without it both could read the same balance and each pass
					// a check the pair together violates.
					const serverBalances = new Map<string, number>();

					for (const bill of remittedBills) {
						await tx.execute(
							sql`SELECT id FROM bills WHERE id = ${bill.billId} FOR UPDATE`,
						);

						const [current] = await tx
							.select({ whtBalance: vwWhtBalances.whtBalance })
							.from(vwWhtBalances)
							.where(eq(vwWhtBalances.id, bill.billId));

						if (!current) {
							throw new RemittanceValidationError(
								`Bill ${bill.invoiceNo} has no withholding tax to remit`,
							);
						}

						const balance = Number(current.whtBalance);

						if (Number(bill.amount ?? 0) > balance) {
							throw new RemittanceValidationError(
								`Remittance amount exceeds the WHT balance on bill ${bill.invoiceNo}`,
							);
						}

						serverBalances.set(bill.billId, balance);
					}

					await tx.insert(whtRemittanceLines).values(
						remittedBills.map((bill, index) => ({
							remittanceId,
							billId: bill.billId,
							amount: toDecimalString(bill.amount ?? 0),
							lineNumber: index + 1,
							currentBalance: toDecimalString(
								serverBalances.get(bill.billId) ?? 0,
							),
							dc: "credit" as const,
						})),
					);

					await createJournalEntry({
						entry: {
							source: JOURNAL_SOURCE,
							sourceId: remittanceId,
							entryDate: remittanceDate,
							description: memo || `WHT remittance no ${remittanceNo}`,
							reference,
						},
						lines: journalLines,
						tx,
					});

					if (bankId) {
						await createBankingEntry({
							entry: {
								source: JOURNAL_SOURCE,
								sourceId: remittanceId,
								transactionDate: remittanceDate,
								dc: "credit" as const,
								amount: totalRemitted.toString(),
								reference: reference ?? `WHT remittance no ${remittanceNo}`,
								bankId,
							},
							tx,
						});
					}
				});

				await logActivity({
					data: {
						action: id ? "update wht remittance" : "create wht remittance",
						userId,
						description: `${id ? "Updated" : "Created"} WHT remittance no ${remittanceNo}`,
					},
				});

				return success(undefined);
			} catch (error) {
				if (error instanceof RemittanceValidationError) {
					return failure({
						type: "ValidationError",
						message: error.message,
					});
				}

				console.error(error);
				return failure({
					type: "ApplicationError",
					message: "Failed to create/update WHT remittance",
				});
			}
		},
	);

export const deleteRemittance = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(z.string().min(1, { error: "Remittance id is not valid" }))
	.handler(
		async ({
			data: remittanceId,
			context: {
				user: { id: userId },
			},
		}) => {
			await requirePermission("wht-remittances:delete");

			try {
				const remittance = await db.query.whtRemittances.findFirst({
					columns: { id: true, remittanceNo: true },
					where: eq(whtRemittances.id, remittanceId),
				});

				if (!remittance) {
					return failure({
						type: "NotFoundError",
						message: "Remittance not found",
					});
				}

				await db.transaction(async (tx) => {
					// The lines cascade with the header, which restores the WHT balance on
					// every bill the remittance covered.
					await tx
						.delete(whtRemittances)
						.where(eq(whtRemittances.id, remittanceId));
					await deleteJournalEntry({
						source: JOURNAL_SOURCE,
						sourceId: remittanceId,
						tx,
					});
					await deleteBankingEntry({
						source: JOURNAL_SOURCE,
						sourceId: remittanceId,
						tx,
					});
				});

				await logActivity({
					data: {
						action: "delete wht remittance",
						userId,
						description: `Deleted WHT remittance no ${remittance.remittanceNo}`,
					},
				});

				return success(undefined);
			} catch (error) {
				console.error(error);
				return failure({
					type: "ApplicationError",
					message: "Failed to delete WHT remittance",
				});
			}
		},
	);
