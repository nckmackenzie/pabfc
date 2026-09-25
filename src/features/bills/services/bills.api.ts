import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, gt, ilike, inArray, or, type SQL, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/drizzle/db";
import { billItems, bills, ledgerAccounts, vwInvoices } from "@/drizzle/schema";
import {
	billSchema,
	billValidateSearch,
	whtCertificateSchema,
} from "@/features/bills/services/schemas";
import { findInvalidPostingAccountIdsByType } from "@/features/coa/services/account-option-filter";
import {
	billLineAmounts,
	sumBillLineAmounts,
} from "@/features/bills/lib/bill-totals";
import { toDecimalString } from "@/lib/helpers";
import { requirePermission } from "@/lib/permissions/permissions";
import { failure, success } from "@/lib/result";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { logActivity } from "@/services/activity-logger";
import { resolveAccountRole } from "@/services/ledger-account-mappings";
import {
	areJournalValuesBalanced,
	createJournalEntry,
	deleteJournalEntry,
} from "@/services/journal";

export const getBills = createServerFn()
	.middleware([authMiddleware])
	.validator(billValidateSearch)
	.handler(async ({ data }) => {
		await requirePermission("bills:view");
		const { q, status } = data ?? {};
		const filters: Array<SQL> = [];
		if (q) {
			const searchFilters = or(
				ilike(vwInvoices.invoiceNo, `%${q}%`),
				ilike(vwInvoices.name, `%${q}%`),
				ilike(sql`CAST(${vwInvoices.total} AS TEXT)`, `%${q}%`),
				ilike(sql`CAST(${vwInvoices.totalPayment} AS TEXT)`, `%${q}%`)
			);
			if (searchFilters) filters.push(searchFilters);
		}
		if (status && status !== "all") {
			// Filter on the derived label rather than the stored workflow status,
			// so "overdue" and "partially-paid" reflect the payment lines.
			filters.push(eq(vwInvoices.displayStatus, status));
		}
		// The view carries its own ORDER BY, but a live view's ordering is not
		// guaranteed to survive the outer query the way matview storage did, so
		// the list states the order it wants.
		return await db
			.select()
			.from(vwInvoices)
			.where(and(...filters))
			.orderBy(desc(vwInvoices.invoiceDate), desc(vwInvoices.invoiceNo))
			.limit(100);
	});

export const getBillById = createServerFn()
	.middleware([authMiddleware])
	.validator((billId: string) => billId)
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
						whtApplicable: true,
						whtRate: true,
						whtAmount: true,
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
	.validator(billSchema)
	.handler(
		async ({
			data,
			context: {
				user: { id: userId },
			},
		}) => {
			await requirePermission(data.id ? "bills:update" : "bills:create");

			const vatAccountId = await resolveAccountRole("vat_input");

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

			// Both VAT and WHT are recomputed here from the submitted rates rather
			// than taken from the client; the figures the form showed are display only.
			const lineAmounts = lines.map(billLineAmounts);

			const billItemsValues = lines.map((line, index) => {
				const amounts = lineAmounts[index];
				const whtApplicable = Boolean(line.whtApplicable);
				return {
					accountId: +line.accountId,
					description: line.description?.toLowerCase() ?? null,
					subTotal: toDecimalString(amounts.subTotal),
					vatType: line.vatType ?? "none",
					taxAmount: toDecimalString(amounts.taxAmount),
					total: toDecimalString(amounts.total),
					whtApplicable,
					whtRate: whtApplicable ? toDecimalString(line.whtRate) : null,
					whtAmount: toDecimalString(amounts.whtAmount),
				};
			});

			const {
				subTotal,
				taxAmount: tax,
				total,
				whtAmount,
				netPayable,
			} = sumBillLineAmounts(lineAmounts);

			if (whtAmount > total) {
				return failure({
					type: "ValidationError",
					message: "Withholding tax cannot exceed the bill total.",
				});
			}

			const selectableAccounts = await db.query.ledgerAccounts.findMany({
				columns: {
					id: true,
					name: true,
					type: true,
					isActive: true,
					isPosting: true,
					parentId: true,
				},
				where: inArray(
					ledgerAccounts.id,
					billItemsValues.map((line) => line.accountId)
				),
			});

			const invalidBillAccountIds = findInvalidPostingAccountIdsByType(
				selectableAccounts,
				billItemsValues.map((line) => line.accountId),
				["expense", "asset"]
			);

			if (invalidBillAccountIds.length > 0) {
				return failure({
					type: "ValidationError",
					message: "Selected bill accounts must be active posting asset or expense accounts.",
				});
			}

			const accountsPayableId = await resolveAccountRole("accounts_payable");
			const whtPayableId =
				whtAmount > 0 ? await resolveAccountRole("wht_payable") : null;

			const ledgerLines = billItemsValues.map((line, index) => ({
				lineNumber: index + 1,
				accountId: line.accountId,
				amount: line.subTotal.toString(),
				memo: line.description,
				dc: "debit" as "debit" | "credit",
			}));

			if (tax > 0) {
				ledgerLines.push({
					lineNumber: ledgerLines.length + 1,
					accountId: vatAccountId as number,
					amount: tax.toString(),
					memo: `VAT`,
					dc: "debit" as "debit" | "credit",
				});
			}

			// The debit side is untouched by withholding. Only the credit side splits:
			// the vendor is owed the total less the tax withheld on their behalf, and
			// the withheld portion becomes a liability to KRA until it is remitted.
			ledgerLines.push({
				lineNumber: ledgerLines.length + 1,
				accountId: accountsPayableId,
				amount: netPayable.toString(),
				memo: `Bill ${invoiceNo}`,
				dc: "credit" as "debit" | "credit",
			});

			if (whtPayableId) {
				ledgerLines.push({
					lineNumber: ledgerLines.length + 1,
					accountId: whtPayableId,
					amount: whtAmount.toString(),
					memo: `WHT withheld on bill ${invoiceNo}`,
					dc: "credit" as "debit" | "credit",
				});
			}

			if (!areJournalValuesBalanced(ledgerLines)) {
				return failure({
					type: "ApplicationError",
					message: "Journal entry values do not balance",
				});
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
							whtAmount: whtAmount.toString(),
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
								whtAmount: whtAmount.toString(),
								createdBy: userId,
							},
						})
						.returning({ id: bills.id });

					if (id) {
						await tx.delete(billItems).where(eq(billItems.billId, id));
						await deleteJournalEntry({ source: "bills", sourceId: id, tx });
					}

					await tx.insert(billItems).values(
						billItemsValues.map(({ accountId, ...rest }) => ({
							billId,
							expenseAccountId: accountId,
							...rest,
						}))
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
							description: data.id ? `Updated bill ${invoiceNo}` : `Created bill ${invoiceNo}`,
						},
					});
				});

				return success(undefined);
			} catch (error) {
				console.error(error);
				return failure({
					type: "ApplicationError",
					message: `Failed to ${id ? "update" : "create"} bill`,
				});
			}
		}
	);

export const deleteBill = createServerFn()
	.middleware([authMiddleware])
	.validator((billId: string) => billId)
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
					whtRemittances: { columns: { id: true } },
				},
			});

			if (!bill) {
				return failure({
					type: "ApplicationError",
					message: "Bill not found",
				});
			}

			if (bill.payments.length > 0) {
				return failure({
					type: "ApplicationError",
					message: "Bill has payments",
				});
			}

			// The remittance lines reference the bill, so without this the delete would
			// fail on the foreign key and surface as an unexplained error.
			if (bill.whtRemittances.length > 0) {
				return failure({
					type: "ApplicationError",
					message: "Bill has withholding tax remitted against it",
				});
			}

			try {
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

				return success(undefined);
			} catch (error) {
				console.error(error);
				return failure({
					type: "ApplicationError",
					message: "Failed to delete bill",
				});
			}
		}
	);

/**
 * Records the iTax certificate for tax already withheld on a bill. Purely a
 * record-keeping update — it moves no money and posts nothing to the ledger, so
 * it is deliberately separate from `upsertBill`, which a bill with payments
 * against it can no longer run.
 */
export const updateBillWhtCertificate = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(whtCertificateSchema)
	.handler(
		async ({
			data: { billId, whtCertificateNo, whtCertificateIssuedDate },
			context: {
				user: { id: userId },
			},
		}) => {
			await requirePermission("bills:update");

			const bill = await db.query.bills.findFirst({
				columns: { id: true, invoiceNo: true, whtAmount: true },
				where: eq(bills.id, billId),
			});

			if (!bill) {
				return failure({
					type: "NotFoundError",
					message: "Bill not found",
				});
			}

			if (parseFloat(bill.whtAmount) <= 0) {
				return failure({
					type: "ValidationError",
					message: "No withholding tax was deducted on this bill",
				});
			}

			try {
				await db
					.update(bills)
					.set({
						whtCertificateNo: whtCertificateNo.toUpperCase(),
						whtCertificateIssuedDate,
					})
					.where(eq(bills.id, billId));

				await logActivity({
					data: {
						action: "update bill wht certificate",
						userId,
						description: `Recorded WHT certificate ${whtCertificateNo.toUpperCase()} on bill ${bill.invoiceNo}`,
					},
				});

				return success(undefined);
			} catch (error) {
				console.error(error);
				return failure({
					type: "ApplicationError",
					message: "Failed to record WHT certificate",
				});
			}
		}
	);

export const getUnpaidBillsBySupplier = createServerFn()
	.middleware([authMiddleware])
	.validator((vendorId: string) => vendorId)
	.handler(async ({ data: vendorId }) =>
		db
			.select()
			.from(vwInvoices)
			.where(and(eq(vwInvoices.vendorId, vendorId), gt(vwInvoices.balance, "0")))
	);
