import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import {
	and,
	asc,
	desc,
	eq,
	gte,
	ilike,
	lte,
	or,
	type SQL,
	sql,
} from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "@/drizzle/db";
import { bankAccounts, bankPostings } from "@/drizzle/schema";
import {
	bankPostingClearenceFormSchema,
	bankPostingSchema,
	bulkBankClearingsFormSchema,
	clearBankingsFilterFormSchema,
} from "@/features/bankings/services/schema";
import { ApplicationError } from "@/lib/error-handling/app-error";
import { normalizeDateRange } from "@/lib/helpers";
import { requirePermission } from "@/lib/permissions/permissions";
import { searchValidateSchema } from "@/lib/schema-rules";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { logActivity } from "@/services/activity-logger";
import {
	areJournalValuesBalanced,
	createJournalEntry,
	deleteJournalEntry,
	getCashEquivalentAccountId,
} from "@/services/journal";

export const getBanks = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		return db.query.bankAccounts.findMany({
			orderBy: [asc(sql`LOWER(${bankAccounts.bankName})`)],
		});
	});

export const getBankPostings = createServerFn()
	.middleware([authMiddleware])
	.inputValidator(searchValidateSchema)
	.handler(async ({ data }) => {
		const filters: Array<SQL> = [];
		filters.push(eq(bankPostings.source, "postings"));

		if (data.q) {
			const searchFilters = or(
				ilike(bankAccounts.bankName, `%${data.q}%`),
				ilike(bankPostings.reference, `%${data.q}%`),
				ilike(
					sql`to_char(${bankPostings.transactionDate}, 'DD-MM-YYYY')`,
					`%${data.q}%`,
				),
				ilike(
					sql`to_char(${bankPostings.amount}, '999999999.99')`,
					`%${data.q}%`,
				),
				ilike(bankPostings.narration, `%${data.q}%`),
			);
			if (searchFilters) {
				filters.push(searchFilters);
			}
		}

		return db
			.select({
				id: bankPostings.id,
				transactionDate: bankPostings.transactionDate,
				bankName: bankAccounts.bankName,
				direction: sql<string>`CASE WHEN bank_postings.dc = 'credit' THEN 'Money Out' ELSE 'Money In' END`,
				amount: bankPostings.amount,
				reference: bankPostings.reference,
				cleared: bankPostings.cleared,
			})
			.from(bankPostings)
			.innerJoin(bankAccounts, eq(bankAccounts.id, bankPostings.bankId))
			.where(and(...filters))
			.orderBy(desc(bankAccounts.createdAt));
	});

export const getBankPosting = createServerFn()
	.middleware([authMiddleware])
	.inputValidator(z.string().min(1, "Bank posting ID is required"))
	.handler(async ({ data: postingId }) => {
		const posting = await db.query.bankPostings.findFirst({
			columns: {
				cleared: false,
				clearedAt: false,
				createdAt: false,
				source: false,
				sourceId: false,
			},
			where: and(
				eq(bankPostings.id, postingId),
				eq(bankPostings.source, "postings"),
			),
		});

		if (!posting) {
			throw notFound();
		}

		return posting;
	});

export const upsertBankPosting = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator(bankPostingSchema)
	.handler(
		async ({
			data,
			context: {
				user: { id: userId },
			},
		}) => {
			await requirePermission(data.id ? "banking:update" : "banking:create");
			const {
				id,
				amount,
				bankId,
				narration,
				reference,
				transactionDate,
				counterAccountId,
				direction,
			} = data;

			const bankAccountId = await getCashEquivalentAccountId({
				paymentMethod: "bank",
				bankId,
			});

			const journalLines = [
				{
					lineNumber: 1,
					dc: direction,
					accountId: bankAccountId,
					amount: amount.toString(),
					memo: narration,
				},
				{
					lineNumber: 2,
					dc:
						direction === "debit" ? "credit" : ("debit" as "debit" | "credit"),
					accountId: parseInt(counterAccountId, 10),
					amount: amount.toString(),
					memo: narration,
				},
			];

			if (!areJournalValuesBalanced(journalLines)) {
				throw new ApplicationError("Journal values are not balanced");
			}

			if (data.id) {
				const posting = await db.query.bankPostings.findFirst({
					columns: { id: true },
					where: and(
						eq(bankPostings.id, data.id),
						eq(bankPostings.cleared, false),
						eq(bankPostings.source, "postings"),
					),
				});
				if (!posting) {
					throw new ApplicationError("Cannot update the bank posting!");
				}
			}

			try {
				await db.transaction(async (tx) => {
					const [{ id: bankPostingId }] = await tx
						.insert(bankPostings)
						.values({
							id: id ?? nanoid(),
							bankId,
							amount: amount.toString(),
							narration,
							reference,
							counterAccountId: parseInt(counterAccountId, 10),
							dc: direction,
							transactionDate,
							source: "postings",
						})
						.onConflictDoUpdate({
							target: bankPostings.id,
							set: {
								bankId,
								amount: amount.toString(),
								narration,
								reference,
								counterAccountId: parseInt(counterAccountId, 10),
								dc: direction,
								transactionDate,
								source: "postings",
							},
						})
						.returning({ id: bankPostings.id });

					if (data.id) {
						await deleteJournalEntry({
							source: "bank postings",
							sourceId: data.id,
							tx,
						});
					}

					await createJournalEntry({
						entry: {
							entryDate: transactionDate,
							description: narration,
							reference,
							source: "bank postings",
							sourceId: bankPostingId,
						},
						lines: journalLines,
						tx,
					});

					await logActivity({
						data: {
							action: data.id ? "update bank posting" : "create bank posting",
							description: data.id
								? `Updated bank posting with reference ${data.reference}`
								: `Created bank posting with reference ${reference}`,
							userId,
						},
					});
				});
			} catch (error) {
				console.error(error);
				throw new ApplicationError(
					`Failed to ${data.id ? "update" : "create"} bank posting`,
				);
			}
		},
	);

export const deleteBankPosting = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator(z.string().min(1, "Bank posting ID is required"))
	.handler(async ({ data: postingId }) => {
		await requirePermission("banking:delete");
		const posting = await db.query.bankPostings.findFirst({
			where: and(
				eq(bankPostings.id, postingId),
				eq(bankPostings.cleared, false),
				eq(bankPostings.source, "postings"),
			),
		});
		if (!posting) {
			throw new ApplicationError("Cannot delete the bank posting!");
		}

		try {
			await db.transaction(async (tx) => {
				await deleteJournalEntry({
					source: "bank postings",
					sourceId: postingId,
					tx,
				});
				await tx.delete(bankPostings).where(eq(bankPostings.id, postingId));
			});
		} catch (error) {
			console.error(error);
			throw new ApplicationError("Failed to delete bank posting");
		}
	});

export const clearBankPosting = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator(bankPostingClearenceFormSchema)
	.handler(
		async ({
			data,
			context: {
				user: { id: userId },
			},
		}) => {
			await requirePermission("banking:clear");
			const { bankingId, clearedAt } = data;
			const posting = await db.query.bankPostings.findFirst({
				where: and(
					eq(bankPostings.id, bankingId),
					eq(bankPostings.cleared, false),
					eq(bankPostings.source, "postings"),
				),
			});
			if (!posting) {
				throw new ApplicationError("Cannot clear the bank posting!");
			}

			if (
				new Date(clearedAt).setHours(23, 59, 59, 999) <
				new Date(posting.transactionDate).setHours(23, 59, 59, 999)
			) {
				throw new ApplicationError(
					"Clearing date cannot be before the transaction date",
				);
			}

			try {
				await db.transaction(async (tx) => {
					await tx
						.update(bankPostings)
						.set({ cleared: true, clearedAt })
						.where(eq(bankPostings.id, bankingId));

					await logActivity({
						data: {
							action: "clear bank posting",
							description: `Cleared bank posting with reference ${posting.reference}`,
							userId,
						},
					});
				});
			} catch (error) {
				console.error(error);
				throw new ApplicationError("Failed to clear bank posting");
			}
		},
	);

export const getUnclearedBankings = createServerFn()
	.middleware([authMiddleware])
	.inputValidator(clearBankingsFilterFormSchema)
	.handler(async ({ data }) => {
		await requirePermission("banking:clear");

		const { bankId, ...rest } = data;
		const { from, to } = normalizeDateRange(rest.from, rest.to);

		const bankings = await db.query.bankPostings.findMany({
			columns: {
				bankId: false,
				sourceId: false,
				cleared: false,
				clearedAt: false,
				counterAccountId: false,
			},
			where: and(
				eq(bankPostings.bankId, bankId),
				eq(bankPostings.cleared, false),
				gte(bankPostings.transactionDate, from),
				lte(bankPostings.transactionDate, to),
			),
		});
		return bankings;
	});

export const clearBankings = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator(bulkBankClearingsFormSchema)
	.handler(
		async ({
			data,
			context: {
				user: { id: userId },
			},
		}) => {
			await requirePermission("banking:clear");
			const { bankings } = data;
			const clearedOnlyBankings = bankings.filter((b) => b.selected);

			if (clearedOnlyBankings.length === 0) {
				throw new ApplicationError("No bankings selected to clear");
			}

			await db.transaction(async (tx) => {
				for (const banking of clearedOnlyBankings) {
					await tx
						.update(bankPostings)
						.set({ cleared: true, clearedAt: banking.clearedAt })
						.where(eq(bankPostings.id, banking.bankingId));
				}

				await logActivity({
					data: {
						action: "clear bank postings",
						description: `Cleared ${clearedOnlyBankings.length} bank postings`,
						userId,
					},
				});
			});

			return {
				message: "Bankings cleared successfully",
			};
		},
	);
