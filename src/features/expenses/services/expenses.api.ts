import { createServerFn } from "@tanstack/react-start";
import { sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import {
	expenseDetails,
	expenseHeaders,
	journalEntries,
	journalLines,
} from "@/drizzle/schema";
import {
	getCashEquivalentsAccountId,
	getVatAccountId,
} from "@/features/coa/services/coa.api";
import { expenseSchema } from "@/features/expenses/services/schemas";
import { calculateExpenseRequest } from "@/features/expenses/utils";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { logActivity } from "@/services/activity-logger";

export const getExpenseNo = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.handler(async () => {
		const { rows } = await db.execute<{ expenseNo: number }>(
			sql`SELECT COALESCE(MAX(expense_no),0) + 1 as "expenseNo" FROM expense_headers`,
		);
		return rows[0].expenseNo;
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
			const { details, expenseDate, payeeId, paymentMethod, reference } = data;
			const expenseNo = await getExpenseNo();

			const { subTotal, taxAmount, grandTotal, lines } =
				calculateExpenseRequest(details);

			const vatAccountId = await getVatAccountId();

			if (taxAmount > 0 && vatAccountId === null) {
				throw new Error("VAT Account not found. Define one in settings.");
			}

			const expenseId = await db.transaction(async (tx) => {
				const [{ id: expenseId }] = await tx
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
							description: "",
						})),
					);
				}

				const [{ id: journalId }] = await tx
					.insert(journalEntries)
					.values({
						entryDate: expenseDate,
						source: "expenses",
						sourceId: expenseId,
						reference: expenseNo.toString(),
					})
					.returning({ id: journalEntries.id });

				lines.forEach(async (line, index) => {
					await tx.insert(journalLines).values({
						journalEntryId: journalId,
						lineNumber: index + 1,
						accountId: parseInt(line.accountId, 10),
						amount: line.amountExlusiveTax.toString(),
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
						action: "create expense",
						userId,
						description: `Created expense ${expenseNo}`,
					},
				});

				return expenseId;
			});

			return expenseId;
		},
	);
