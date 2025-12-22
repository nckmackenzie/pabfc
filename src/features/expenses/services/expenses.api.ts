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
import { db } from "@/drizzle/db";
import {
	expenseAttachments,
	expenseDetails,
	expenseHeaders,
	journalEntries,
	journalLines,
	ledgerAccounts,
	payees,
} from "@/drizzle/schema";
import {
	getCashEquivalentsAccountId,
	getVatAccountId,
} from "@/features/coa/services/coa.api";
import {
	expenseSchema,
	expenseValidateSearch,
} from "@/features/expenses/services/schemas";
import { calculateExpenseRequest } from "@/features/expenses/utils";
import { normalizeDateRange } from "@/lib/helpers";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { logActivity } from "@/services/activity-logger";
import { requirePermission } from "@/lib/permissions/permissions";
import { NotFoundError } from "@/lib/error-handling/app-error";

export const getExpenseNo = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		const { rows } = await db.execute<{ expenseNo: number }>(
			sql`SELECT COALESCE(MAX(expense_no),0) + 1 as "expenseNo" FROM expense_headers`,
		);
		return rows[0].expenseNo;
	});

export const getExpenses = createServerFn()
	.middleware([authMiddleware])
	.inputValidator(expenseValidateSearch)
	.handler(async ({ data }) => {
		const { q, from, to } = data;

		const filters: Array<SQL> = [];

		if (q) {
			const searchFilters = or(
				ilike(sql`CAST(${expenseHeaders.expenseNo} AS TEXT)`, `%${q}%`),
				ilike(sql`CAST(${expenseHeaders.expenseDate} AS TEXT)`, `%${q}%`),
				ilike(sql`CAST(${expenseHeaders.totalAmount} AS TEXT)`, `%${q}%`),
				ilike(sql`CAST(${expenseHeaders.paymentMethod} AS TEXT)`, `%${q}%`),
				ilike(expenseHeaders.reference, `%${q}%`),
				ilike(payees.name, `%${q}%`),
			);
			if (searchFilters) {
				filters.push(searchFilters);
			}
		}

		if (from && to) {
			const { from: normalizedFrom, to: normalizedTo } = normalizeDateRange(
				from,
				to,
			);
			filters.push(gte(expenseHeaders.expenseDate, normalizedFrom));
			filters.push(lte(expenseHeaders.expenseDate, normalizedTo));
		}

		return db
			.select({
				id: expenseHeaders.id,
				expenseNo: expenseHeaders.expenseNo,
				expenseDate: expenseHeaders.expenseDate,
				expenseAmount: expenseHeaders.totalAmount,
				payee: payees.name,
				paymentMethod: expenseHeaders.paymentMethod,
				reference: expenseHeaders.reference,
				attachmentCount: sql<number>`COUNT(${expenseAttachments.id})`,
			})
			.from(expenseHeaders)
			.innerJoin(payees, eq(expenseHeaders.payeeId, payees.id))
			.leftJoin(
				expenseAttachments,
				eq(expenseHeaders.id, expenseAttachments.expenseHeaderId),
			)
			.where(and(...filters))
			.groupBy(
				expenseHeaders.id,
				expenseHeaders.expenseNo,
				expenseHeaders.expenseDate,
				expenseHeaders.totalAmount,
				payees.name,
				expenseHeaders.paymentMethod,
				expenseHeaders.reference,
			)
			.orderBy(desc(expenseHeaders.expenseNo));
	});

export const getExpense = createServerFn()
	.middleware([authMiddleware])
	.inputValidator((expenseId: string) => expenseId)
	.handler(async ({ data: expenseId }) => {
		return db.query.expenseHeaders.findFirst({
			with: {
				attachments: {
					columns: {
						updatedAt: false,
						createdAt: false,
						expenseHeaderId: false,
					},
				},
				details: {
					columns: { updatedAt: false, createdAt: false },
					orderBy: asc(expenseDetails.lineNumber),
				},
			},
			where: eq(expenseHeaders.id, expenseId),
		});
	});

export const createExpense = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator(expenseSchema)
	.handler(
		async ({
			data,
			context: {
				user: { id: userId },
			},
		}) => {
			const {
				details,
				expenseDate,
				payeeId,
				paymentMethod,
				reference,
				expenseNo: expenseNoFormData,
				attachments,
			} = data;
			const expenseNo = await getExpenseNo();

			const { subTotal, taxAmount, grandTotal, lines } =
				calculateExpenseRequest(details);

			const vatAccountId = await getVatAccountId();

			if (taxAmount > 0 && vatAccountId === null) {
				throw new Error("VAT Account not found. Define one in settings.");
			}

			const returnedId = await db.transaction(async (tx) => {
				let expenseId: string;
				if (data.id) {
					expenseId = data.id;
					await tx
						.update(expenseHeaders)
						.set({
							expenseDate,
							payeeId,
							paymentMethod,
							reference,
							subTotal: subTotal.toString(),
							taxAmount: taxAmount.toString(),
							totalAmount: grandTotal.toString(),
							createdByUserId: userId,
						})
						.where(eq(expenseHeaders.id, data.id));
				} else {
					const [{ id }] = await tx
						.insert(expenseHeaders)
						.values({
							expenseDate,
							expenseNo,
							payeeId,
							paymentMethod,
							reference,
							subTotal: subTotal.toString(),
							taxAmount: taxAmount.toString(),
							totalAmount: grandTotal.toString(),
							createdByUserId: userId,
						})
						.returning({ id: expenseHeaders.id });
					expenseId = id;
				}

				await tx
					.delete(expenseDetails)
					.where(eq(expenseDetails.expenseHeaderId, expenseId));
				await tx
					.delete(expenseAttachments)
					.where(eq(expenseAttachments.expenseHeaderId, expenseId));
				await tx
					.delete(journalEntries)
					.where(
						and(
							eq(journalEntries.sourceId, expenseId),
							eq(journalEntries.source, "expenses"),
						),
					);

				if (attachments && attachments.length > 0) {
					const formattedAttachments = attachments.map((attachment) => ({
						expenseHeaderId: expenseId,
						fileUrl: attachment.url,
						fileName: attachment.filename,
						fileType: attachment.mimeType,
					}));
					await tx.insert(expenseAttachments).values(formattedAttachments);
				}

				if (lines.length > 0) {
					await tx.insert(expenseDetails).values(
						lines.map((line, index) => ({
							expenseHeaderId: expenseId,
							lineNumber: index + 1,
							accountId: parseInt(line.accountId, 10),
							quantity: line.quantity.toString(),
							unitPrice: line.unitPrice.toString(),
							lineSubtotal: line.amountExlusiveTax.toString(),
							vatType: line.vatType,
							taxAmount: line.taxAmount.toString(),
							lineTotal: line.totalInclusiveTax.toString(),
							description: line.description,
						})),
					);
				}

				const [{ id: journalId }] = await tx
					.insert(journalEntries)
					.values({
						entryDate: expenseDate,
						source: "expenses",
						sourceId: expenseId,
						reference: data.id
							? expenseNoFormData.toString()
							: expenseNo.toString(),
					})
					.returning({ id: journalEntries.id });

				lines.forEach(async (line, index) => {
					await tx.insert(journalLines).values({
						journalEntryId: journalId,
						lineNumber: index + 1,
						accountId: parseInt(line.accountId, 10),
						amount: line.amountExlusiveTax.toString(),
						memo: line.description,
						dc: "debit",
					});
				});

				if (taxAmount > 0) {
					await tx.insert(journalLines).values({
						journalEntryId: journalId,
						lineNumber: lines.length + 1,
						accountId: vatAccountId as number,
						amount: taxAmount.toString(),
						dc: "debit",
					});
				}

				const cashAccountId = await getCashEquivalentsAccountId({
					data: paymentMethod,
				});

				await tx.insert(journalLines).values({
					journalEntryId: journalId,
					lineNumber: lines.length + 1 + (taxAmount > 0 ? 1 : 0),
					accountId: cashAccountId as number,
					amount: grandTotal.toString(),
					dc: "credit",
				});

				await logActivity({
					data: {
						action: data.id ? "update expense" : "create expense",
						userId,
						description: data.id
							? `Updated expense ${expenseNoFormData}`
							: `Created expense ${expenseNo}`,
					},
				});

				return expenseId;
			});

			return returnedId;
		},
	);

export const getExpenseJournal = createServerFn()
	.inputValidator((expenseId: string) => expenseId)
	.handler(async ({ data: expenseId }) => {
		return db
			.select({
				id: journalLines.id,
				reference: journalEntries.reference,
				date: journalEntries.entryDate,
				lineNumber: journalLines.lineNumber,
				amount: journalLines.amount,
				dc: journalLines.dc,
				memo: journalLines.memo,
				account: ledgerAccounts.name,
			})
			.from(journalLines)
			.innerJoin(
				journalEntries,
				eq(journalLines.journalEntryId, journalEntries.id),
			)
			.innerJoin(ledgerAccounts, eq(journalLines.accountId, ledgerAccounts.id))
			.where(
				and(
					eq(journalEntries.sourceId, expenseId),
					eq(journalEntries.source, "expenses"),
				),
			)
			.orderBy(desc(journalLines.lineNumber));
	});

	export const deleteExpense = createServerFn({ method: "POST" })
		.middleware([authMiddleware])
		.inputValidator((expenseId: string) => expenseId)
		.handler(async ({ data: expenseId, context: { user: { id: userId } } }) => {

			await requirePermission('expenses:delete')

			const expense = await db.query.expenseHeaders.findFirst({
				columns: {expenseNo:true},
				where: eq(expenseHeaders.id, expenseId),
			})

			if (!expense) {
				throw new NotFoundError("Expense");
			}

			await db.transaction(async (tx) => {
				await tx.delete(expenseDetails).where(eq(expenseDetails.expenseHeaderId, expenseId));
				await tx.delete(expenseAttachments).where(eq(expenseAttachments.expenseHeaderId, expenseId));
				await tx.delete(journalEntries).where(and(eq(journalEntries.sourceId, expenseId), eq(journalEntries.source, "expenses")));
				await tx.delete(expenseHeaders).where(eq(expenseHeaders.id, expenseId));

				await logActivity({
					data: {
						action: "delete expense",
						userId,
						description: `Deleted expense ${expense.expenseNo}`,
					},
				});
			})
			
		});
