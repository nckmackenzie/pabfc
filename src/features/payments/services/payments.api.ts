import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/drizzle/db";
import { bankAccounts, billPaymentLines, billPayments } from "@/drizzle/schema";
import { paymentFormSchema } from "@/features/payments/services/schema";
import { ApplicationError } from "@/lib/error-handling/app-error";
import { inngest } from "@/lib/inngest/client";
import { requirePermission } from "@/lib/permissions/permissions";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { logActivity } from "@/services/activity-logger";
import { createBankingEntry, deleteBankingEntry } from "@/services/banking";
import {
	areJournalValuesBalanced,
	createJournalEntry,
	createOrGetAccountId,
	deleteJournalEntry,
} from "@/services/journal";

export const getPaymentNo = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		const result = await db.execute<{ paymentNo: number }>(
			`SELECT COALESCE(MAX(payment_no), 0) as paymentNo FROM bill_payments`,
		);
		return (result.rows[0]?.paymentNo ?? 0) + 1;
	});

export const createPayment = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator(paymentFormSchema)
	.handler(
		async ({
			data,
			context: {
				user: { id: userId },
			},
		}) => {
			await requirePermission("payments:create");

			const paymentNo = await getPaymentNo();
			const {
				id,
				bills,
				paymentDate,
				paymentMethod,
				reference,
				vendorId,
				bankId,
				memo,
				cashEquivalentAccountId,
			} = data;

			const accountsPayableId = await createOrGetAccountId(
				"accounts payable",
				"liability",
			);

			const paidBills = bills.filter((bill) => bill.selected);

			if (paidBills.length === 0) {
				throw new ApplicationError("No bills selected");
			}

			const totalAmountPaid = paidBills.reduce(
				(acc, bill) => acc + parseFloat(bill.amount?.toString() ?? "0"),
				0,
			);
			let creditingAccountId: number;

			if (paymentMethod === "bank" || paymentMethod === "cheque") {
				if (!bankId) {
					throw new ApplicationError(
						"Bank is required for this payment method",
					);
				}
				const [{ accountId }] = await db
					.select({ accountId: bankAccounts.accountId })
					.from(bankAccounts)
					.where(eq(bankAccounts.id, bankId));
				creditingAccountId = accountId;
			} else {
				if (!cashEquivalentAccountId) {
					throw new ApplicationError(
						"Cash equivalent account is required for this payment method",
					);
				}
				creditingAccountId = Number(cashEquivalentAccountId);
			}

			const journalLines = [
				{
					accountId: accountsPayableId,
					amount: totalAmountPaid.toString(),
					dc: "debit" as const,
					lineNumber: 1,
					memo,
				},
				{
					accountId: creditingAccountId,
					amount: totalAmountPaid.toString(),
					dc: "credit" as const,
					lineNumber: 2,
					memo,
				},
			];

			if (!areJournalValuesBalanced(journalLines)) {
				throw new ApplicationError("Journal values are not balanced");
			}

			try {
				await db.transaction(async (tx) => {
					const [{ id: paymentId }] = await tx
						.insert(billPayments)
						.values({
							id: id ?? nanoid(),
							paymentNo,
							vendorId,
							paymentDate,
							paymentMethod,
							reference,
							bankId,
							creditingAccountId,
							createdBy: userId,
							memo,
						})
						.onConflictDoUpdate({
							target: billPayments.id,
							set: {
								vendorId,
								paymentDate,
								paymentMethod,
								reference,
								bankId,
								creditingAccountId,
								createdBy: userId,
								memo,
							},
						})
						.returning({ id: billPayments.id });

					if (id) {
						await tx
							.delete(billPaymentLines)
							.where(
								eq(
									billPaymentLines.billPaymentId,
									eq(billPaymentLines.billPaymentId, paymentId),
								),
							);
						await deleteJournalEntry({
							source: "bill payment",
							sourceId: paymentId,
							tx,
						});
						await deleteBankingEntry({
							source: "bill payment",
							sourceId: paymentId,
							tx,
						});
					}

					await tx.insert(billPaymentLines).values(
						paidBills.map((bill, index) => ({
							billPaymentId: paymentId,
							billId: bill.billId,
							amount: bill.amount?.toString() ?? "0",
							lineNumber: index + 1,
							dc: "credit" as const,
						})),
					);

					await createJournalEntry({
						entry: {
							source: "bill payment",
							sourceId: paymentId,
							entryDate: paymentDate,
							description: memo || `Payment No ${paymentNo}`,
							reference,
						},
						lines: journalLines,
						tx,
					});

					if (bankId) {
						await createBankingEntry({
							entry: {
								source: "bill payment",
								sourceId: paymentId,
								transactionDate: paymentDate,
								dc: "credit" as const,
								amount: totalAmountPaid.toString(),
								reference: reference ?? `Payment No ${paymentNo}`,
								bankId,
							},
							tx,
						});
					}

					await logActivity({
						data: {
							action: id ? "update payment" : "create payment",
							userId,
							description: `${id ? "Updated" : "Created"} payment no ${paymentNo}`,
						},
					});

					await inngest.send({
						name: "app/bills.update.invoice.status",
						data: {
							paidInvoiceIds: paidBills.map((bill) => bill.billId),
						},
					});
				});
			} catch (error) {
				console.error("🔥", error);
				throw new Error("Failed to create/update payment");
			}

			return "Completed Successfully!";
		},
	);
