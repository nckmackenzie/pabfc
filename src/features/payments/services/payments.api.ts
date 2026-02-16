import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { desc, eq, ilike, or, sql, sum } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "@/drizzle/db";
import {
	bankAccounts,
	billPaymentLines,
	billPayments,
	vendors,
	vwInvoices,
} from "@/drizzle/schema";
import { paymentFormSchema } from "@/features/payments/services/schema";
import { ApplicationError } from "@/lib/error-handling/app-error";
import { inngest } from "@/lib/inngest/client";
import { requirePermission } from "@/lib/permissions/permissions";
import { searchValidateSchema } from "@/lib/schema-rules";
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
			`SELECT COALESCE(MAX(payment_no), 0) as "paymentNo" FROM bill_payments`,
		);
		return (result.rows[0]?.paymentNo ?? 0) + 1;
	});

export const getPayments = createServerFn()
	.middleware([authMiddleware])
	.inputValidator(searchValidateSchema)
	.handler(async ({ data: { q } }) => {
		await requirePermission("payments:view");

		return db
			.select({
				id: billPayments.id,
				paymentNo: billPayments.paymentNo,
				paymentDate: billPayments.paymentDate,
				paymentMethod: billPayments.paymentMethod,
				reference: billPayments.reference,
				vendorName: vendors.name,
				amount: sum(billPaymentLines.amount),
			})
			.from(billPayments)
			.where(
				q
					? or(
							ilike(vendors.name, `%${q}%`),
							ilike(sql`${billPayments.paymentNo}::text`, `%${q}%`),
							ilike(billPayments.paymentMethod, `%${q}%`),
							ilike(billPayments.reference, `%${q}%`),
						)
					: undefined,
			)
			.innerJoin(vendors, eq(billPayments.vendorId, vendors.id))
			.leftJoin(
				billPaymentLines,
				eq(billPayments.id, billPaymentLines.billPaymentId),
			)
			.groupBy(
				billPayments.id,
				billPayments.paymentNo,
				billPayments.paymentDate,
				billPayments.paymentMethod,
				billPayments.reference,
				vendors.name,
			)
			.orderBy(desc(billPayments.paymentNo))
			.limit(100);
	});

export const getPayment = createServerFn()
	.middleware([authMiddleware])
	.inputValidator(z.string().min(1, { error: "Payment id is not valid" }))
	.handler(async ({ data: paymentId }) => {
		await requirePermission("payments:view");
		const payment = await db.query.billPayments.findFirst({
			columns: { vendorId: false, bankId: false },
			where: eq(billPayments.id, paymentId),
			with: {
				vendor: { columns: { id: true, name: true } },
				bank: { columns: { id: true, bankName: true } },
				lines: {
					orderBy: (t, { asc }) => asc(t.lineNumber),
					with: {
						bill: {
							columns: {
								invoiceDate: true,
								invoiceNo: true,
								dueDate: true,
								total: true,
							},
						},
					},
				},
			},
		});

		if (!payment) {
			throw notFound();
		}

		return payment;
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
			if (!data.id) {
				await requirePermission("payments:create");
			} else {
				await requirePermission("payments:update");
			}

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

			if (!id) {
				for (const bill of paidBills) {
					const [{ currentBalance }] = await db
						.select({ currentBalance: vwInvoices.balance })
						.from(vwInvoices)
						.where(eq(vwInvoices.id, bill.billId));
					if (
						parseFloat(bill.amount?.toString() ?? "0") >
						parseFloat(currentBalance)
					) {
						throw new ApplicationError("Payment amount exceeds bill balance");
					}
					bill.balance = parseFloat(currentBalance);
				}
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
							.where(eq(billPaymentLines.billPaymentId, paymentId));
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
							currentBalance: bill.balance.toString(),
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

export const deletePayment = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator(z.string().min(1, { error: "Payment id is not valid" }))
	.handler(
		async ({
			data: paymentId,
			context: {
				user: { id: userId },
			},
		}) => {
			await requirePermission("payments:delete");

			const payment = await db.query.billPayments.findFirst({
				columns: { id: true, paymentNo: true },
				where: eq(billPayments.id, paymentId),
			});

			if (!payment) {
				throw notFound();
			}

			await db.transaction(async (tx) => {
				await tx.delete(billPayments).where(eq(billPayments.id, paymentId));
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
			});

			await logActivity({
				data: {
					action: "delete payment",
					userId,
					description: `Deleted payment no ${payment.paymentNo}`,
				},
			});

			await inngest.send({
				name: "app/bills.update.invoice.status",
				data: {
					paidInvoiceIds: [payment.id],
				},
			});
		},
	);
