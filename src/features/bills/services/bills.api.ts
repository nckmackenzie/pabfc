import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { and, eq, ilike, or, type SQL, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/drizzle/db";
import { billItems, bills, vwInvoices } from "@/drizzle/schema";
import {
	billSchema,
	billValidateSearch,
} from "@/features/bills/services/schemas";
import { ConflictError } from "@/lib/error-handling/app-error";
import { taxCalculator } from "@/lib/helpers";
import { requirePermission } from "@/lib/permissions/permissions";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { logActivity } from "@/services/activity-logger";
import {
	areJournalValuesBalanced,
	createJournalEntry,
	createOrGetAccountId,
	deleteJournalEntry,
	getVatAccountId,
} from "@/services/journal";

export const getBills = createServerFn()
	.middleware([authMiddleware])
	.inputValidator(billValidateSearch)
	.handler(async ({ data }) => {
		await requirePermission("bills:view");
		const { q, status } = data ?? {};
		const filters: Array<SQL> = [];
		if (q) {
			const searchFilters = or(
				ilike(vwInvoices.invoiceNo, `%${q}%`),
				ilike(vwInvoices.name, `%${q}%`),
				ilike(sql`CAST(${vwInvoices.total} AS TEXT)`, `%${q}%`),
				ilike(sql`CAST(${vwInvoices.totalPayment} AS TEXT)`, `%${q}%`),
			);
			if (searchFilters) filters.push(searchFilters);
		}
		if (status && status !== "all") {
			filters.push(eq(vwInvoices.status, status));
		}
		return await db
			.select()
			.from(vwInvoices)
			.where(and(...filters))
			.limit(100);
	});

export const getBillById = createServerFn()
	.middleware([authMiddleware])
	.inputValidator((billId: string) => billId)
	.handler(async ({ data: billId }) => {
		await requirePermission("bills:view");
		const bill = await db.query.bills.findFirst({
			columns: { createdAt: false, updatedAt: false, createdBy: false },
			with: {
				items: {
					columns: {
						id: true,
						expenseAccountId: true,
						vatType: true,
						description: true,
						subTotal: true,
						total: true,
					},
				},
			},
			where: eq(bills.id, billId),
		});
		if (!bill) throw notFound();
		return bill;
	});

export const upsertBill = createServerFn()
	.middleware([authMiddleware])
	.inputValidator(billSchema)
	.handler(
		async ({
			data,
			context: {
				user: { id: userId },
			},
		}) => {
			await requirePermission(data.id ? "bills:update" : "bills:create");

			const vatAccountId = await getVatAccountId();

			const {
				id,
				invoiceDate,
				invoiceNo,
				vendorId,
				isRecurring,
				recurrencePattern,
				recurrenceEndDate,
				terms,
				dueDate,
				lines,
			} = data;

			const billItemsValues = lines.map((line) => {
				const { taxAmount, amountExlusiveTax, totalInclusiveTax } =
					taxCalculator(line.amount, line.vatType ?? "none");
				return {
					expenseAccountId: +line.expenseAccountId,
					description: line.description?.toLowerCase() ?? null,
					subTotal: amountExlusiveTax.toString(),
					vatType: line.vatType ?? "none",
					taxAmount: taxAmount.toString(),
					total: totalInclusiveTax.toString(),
				};
			});

			const { subTotal, tax, total } = billItemsValues.reduce(
				(acc, line) => {
					acc.subTotal += parseFloat(line.subTotal ?? "0");
					acc.tax += parseFloat(line.taxAmount ?? "0");
					acc.total += parseFloat(line.total ?? "0");
					return acc;
				},
				{ subTotal: 0, tax: 0, total: 0 },
			);

			const accountsPayableId = await createOrGetAccountId(
				"accounts payable",
				"liability",
			);

			const ledgerLines = billItemsValues.map((line, index) => ({
				lineNumber: index + 1,
				accountId: line.expenseAccountId,
				amount: line.subTotal.toString(),
				memo: line.description,
				dc: "debit" as "debit" | "credit",
			}));

			if (tax > 0) {
				ledgerLines.push({
					lineNumber: lines.length + 1,
					accountId: vatAccountId as number,
					amount: tax.toString(),
					memo: `VAT`,
					dc: "debit" as "debit" | "credit",
				});
			}

			ledgerLines.push({
				lineNumber: lines.length + 1,
				accountId: accountsPayableId,
				amount: total.toString(),
				memo: `Bill ${invoiceNo}`,
				dc: "credit" as "debit" | "credit",
			});

			if (!areJournalValuesBalanced(ledgerLines)) {
				throw new Error("Journal entry values do not balance");
			}

			try {
				await db.transaction(async (tx) => {
					const [{ id: billId }] = await tx
						.insert(bills)
						.values({
							id: id ?? nanoid(),
							invoiceDate,
							invoiceNo,
							vendorId,
							isRecurring,
							dueDate,
							recurrencyPeriod: isRecurring ? recurrencePattern : null,
							recurrencyEndDate: isRecurring ? recurrenceEndDate : null,
							terms,
							subTotal: subTotal.toString(),
							tax: tax.toString(),
							total: total.toString(),
							status: "pending",
							createdBy: userId,
						})
						.onConflictDoUpdate({
							target: bills.id,
							set: {
								invoiceDate,
								invoiceNo,
								vendorId,
								isRecurring,
								dueDate,
								recurrencyPeriod: isRecurring ? recurrencePattern : null,
								recurrencyEndDate: isRecurring ? recurrenceEndDate : null,
								terms,
								subTotal: subTotal.toString(),
								tax: tax.toString(),
								total: total.toString(),
								createdBy: userId,
							},
						})
						.returning({ id: bills.id });

					if (id) {
						await tx.delete(billItems).where(eq(billItems.billId, id));
						await deleteJournalEntry({ source: "bills", sourceId: id, tx });
					}

					await tx.insert(billItems).values(
						billItemsValues.map((b) => ({
							billId,
							...b,
						})),
					);

					await createJournalEntry({
						entry: {
							source: "bills",
							sourceId: billId,
							entryDate: invoiceDate,
							reference: invoiceNo,
							description: `Bill ${invoiceNo}`,
						},
						lines: ledgerLines,
						tx,
					});

					await logActivity({
						data: {
							action: data.id ? "update bill" : "create bill",
							userId,
							description: data.id
								? `Updated bill ${invoiceNo}`
								: `Created bill ${invoiceNo}`,
						},
					});
				});

				return "Completed successfully";
			} catch (error) {
				console.error(error);
				throw new Error(`Failed to ${id ? "update" : "create"} bill`);
			}
		},
	);

export const deleteBill = createServerFn()
	.middleware([authMiddleware])
	.inputValidator((billId: string) => billId)
	.handler(
		async ({
			data: billId,
			context: {
				user: { id: userId },
			},
		}) => {
			await requirePermission("bills:delete");

			const bill = await db.query.bills.findFirst({
				columns: { id: true, invoiceNo: true },
				where: eq(bills.id, billId),
				with: {
					payments: { columns: { id: true } },
				},
			});

			if (!bill) throw notFound();

			if (bill.payments.length > 0) {
				throw new ConflictError("Bill");
			}

			await db.transaction(async (tx) => {
				await tx.delete(billItems).where(eq(billItems.billId, billId));
				await deleteJournalEntry({ source: "bills", sourceId: billId, tx });
				await tx.delete(bills).where(eq(bills.id, billId));
			});

			await logActivity({
				data: {
					action: "delete bill",
					userId,
					description: `Deleted bill for invoice ${bill.invoiceNo}`,
				},
			});
		},
	);
