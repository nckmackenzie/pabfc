import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq, gt, gte, isNotNull, lt, lte, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { vwInvoices } from "@/drizzle/schema";
import { ApplicationError } from "@/lib/error-handling/app-error";
import { requirePermission } from "@/lib/permissions/permissions";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { invoiceReportFormSchema } from "./schema";

type WithDateRange = {
	from: string;
	to: string;
};

type WithVendorId = {
	vendorId: string;
};

export const getInvoicesReport = createServerFn()
	.middleware([authMiddleware])
	.inputValidator(invoiceReportFormSchema)
	.handler(async ({ data }) => {
		await requirePermission("reports:invoices-report");
		const { reportType, dateRange, vendorId } = data;
		const isDateVendorReport =
			reportType === "all" || reportType === "vendor-spend-summary";

		if (isDateVendorReport) {
			if (!dateRange?.from || !dateRange?.to) {
				throw new ApplicationError("Date range is required for this report");
			}
			if (!vendorId) {
				throw new ApplicationError("Vendor is required for this report");
			}
		}

		switch (reportType) {
			case "overdue":
				return getOverdueInvoicesReport();
			case "ageing-summary":
				return getAgeingSummaryReport();
			case "vendor-spend-summary": {
				if (!dateRange?.from || !dateRange?.to || !vendorId) {
					throw new ApplicationError("Invalid filters for vendor summary");
				}
				return getVendorSpendSummaryReport({
					from: dateRange.from,
					to: dateRange.to,
					vendorId,
				});
			}
			case "all": {
				if (!dateRange?.from || !dateRange?.to || !vendorId) {
					throw new ApplicationError("Invalid filters for invoices report");
				}
				return getAllInvoicesReport({
					from: dateRange.from,
					to: dateRange.to,
					vendorId,
				});
			}
			default:
				throw new ApplicationError("Invalid report type");
		}
	});

const getOverdueInvoicesReport = async () => {
	return db
		.select({
			vendor: vwInvoices.name,
			invoiceNo: vwInvoices.invoiceNo,
			dueDate: vwInvoices.dueDate,
			daysOverdue: sql<number>`(current_date - ${vwInvoices.dueDate})::int`.as(
				"daysOverdue",
			),
			amount: vwInvoices.total,
			balance: vwInvoices.balance,
		})
		.from(vwInvoices)
		.where(
			and(
				isNotNull(vwInvoices.dueDate),
				lt(vwInvoices.dueDate, sql`current_date`),
				gt(vwInvoices.balance, "0"),
			),
		)
		.orderBy(asc(vwInvoices.dueDate), asc(vwInvoices.name));
};

const getAgeingSummaryReport = async () => {
	return db
		.select({
			vendor: vwInvoices.name,
			current:
				sql<string>`coalesce(sum(case when ${vwInvoices.dueDate} is null or ${vwInvoices.dueDate} >= current_date then ${vwInvoices.balance} else 0 end), 0)`.as(
					"current",
				),
			days1To30:
				sql<string>`coalesce(sum(case when ${vwInvoices.dueDate} is not null and (current_date - ${vwInvoices.dueDate}) between 1 and 30 then ${vwInvoices.balance} else 0 end), 0)`.as(
					"days1To30",
				),
			days31To60:
				sql<string>`coalesce(sum(case when ${vwInvoices.dueDate} is not null and (current_date - ${vwInvoices.dueDate}) between 31 and 60 then ${vwInvoices.balance} else 0 end), 0)`.as(
					"days31To60",
				),
			days61To90:
				sql<string>`coalesce(sum(case when ${vwInvoices.dueDate} is not null and (current_date - ${vwInvoices.dueDate}) between 61 and 90 then ${vwInvoices.balance} else 0 end), 0)`.as(
					"days61To90",
				),
			days90Plus:
				sql<string>`coalesce(sum(case when ${vwInvoices.dueDate} is not null and (current_date - ${vwInvoices.dueDate}) > 90 then ${vwInvoices.balance} else 0 end), 0)`.as(
					"days90Plus",
				),
			total: sql<string>`coalesce(sum(${vwInvoices.balance}), 0)`.as("total"),
		})
		.from(vwInvoices)
		.where(gt(vwInvoices.balance, "0"))
		.groupBy(vwInvoices.vendorId, vwInvoices.name)
		.orderBy(asc(vwInvoices.name));
};

const getVendorSpendSummaryReport = async ({
	from,
	to,
	vendorId,
}: WithDateRange & WithVendorId) => {
	return db
		.select({
			vendor: vwInvoices.name,
			totalInvoices: sql<number>`count(*)::int`.as("totalInvoices"),
			totalAmount: sql<string>`coalesce(sum(${vwInvoices.total}), 0)`.as(
				"totalAmount",
			),
			totalAmountPaid:
				sql<string>`coalesce(sum(${vwInvoices.totalPayment}), 0)`.as(
					"totalAmountPaid",
				),
			totalBalance: sql<string>`coalesce(sum(${vwInvoices.balance}), 0)`.as(
				"totalBalance",
			),
		})
		.from(vwInvoices)
		.where(
			and(
				gte(vwInvoices.invoiceDate, from),
				lte(vwInvoices.invoiceDate, to),
				vendorId !== "all" ? eq(vwInvoices.vendorId, vendorId) : undefined,
			),
		)
		.groupBy(vwInvoices.vendorId, vwInvoices.name)
		.orderBy(asc(vwInvoices.name));
};

const getAllInvoicesReport = async ({
	from,
	to,
	vendorId,
}: WithDateRange & WithVendorId) =>
	db
		.select({
			invoiceDate: vwInvoices.invoiceDate,
			vendor: vwInvoices.name,
			invoiceNo: vwInvoices.invoiceNo,
			amount: vwInvoices.total,
			amountPaid: vwInvoices.totalPayment,
			balance: vwInvoices.balance,
		})
		.from(vwInvoices)
		.where(
			and(
				gte(vwInvoices.invoiceDate, from),
				lte(vwInvoices.invoiceDate, to),
				vendorId !== "all" ? eq(vwInvoices.vendorId, vendorId) : undefined,
			),
		)
		.orderBy(asc(vwInvoices.invoiceDate), asc(vwInvoices.invoiceNo));
