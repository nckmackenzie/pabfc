import { createServerFn } from "@tanstack/react-start";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import {
	billItems,
	bills,
	vendors,
	whtCorrectionLines,
	whtCorrections,
} from "@/drizzle/schema";
import { requirePermission } from "@/lib/permissions/permissions";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { whtScheduleFormSchema } from "@/features/reports/services/schema";
import type { WhtScheduleRow } from "@/features/reports/lib/wht-schedule";

function compareScheduleRows(a: WhtScheduleRow, b: WhtScheduleRow) {
	const rateA = a.rate === null ? Number.POSITIVE_INFINITY : Number(a.rate);
	const rateB = b.rate === null ? Number.POSITIVE_INFINITY : Number(b.rate);
	if (rateA !== rateB) return rateA - rateB;
	if (a.vendor !== b.vendor) return a.vendor.localeCompare(b.vendor);
	if (a.invoiceDate !== b.invoiceDate) return a.invoiceDate.localeCompare(b.invoiceDate);
	return a.invoiceNo.localeCompare(b.invoiceNo);
}

/**
 * Every withholding deduction made in a period: bill lines entered at billing
 * time, plus correction lines recorded later. A correction is filed in the
 * period it was actually recorded (`correction_date`), not retroactively
 * into the original bill's period, so the two queries filter on different
 * date columns and are merged and re-sorted in application code rather than
 * unioned in SQL.
 *
 * Draft and cancelled bills are excluded from the billing side: nothing was
 * withheld on a bill that was never posted.
 */
export const getWhtSchedule = createServerFn()
	.middleware([authMiddleware])
	.validator(whtScheduleFormSchema)
	.handler(async ({ data }) => {
		await requirePermission("reports:wht-schedule");
		const { from, to } = data.dateRange;

		const billingRows: Array<WhtScheduleRow> = await db
			.select({
				rowType: sql<"billing">`'billing'`.as("row_type"),
				remittanceStatus: sql<null>`NULL`.as("remittance_status"),
				vendor: vendors.name,
				taxPin: vendors.taxPin,
				invoiceNo: bills.invoiceNo,
				invoiceDate: bills.invoiceDate,
				description: billItems.description,
				grossAmount: billItems.subTotal,
				rate: billItems.whtRate,
				whtAmount: billItems.whtAmount,
				certificateNo: bills.whtCertificateNo,
			})
			.from(billItems)
			.innerJoin(bills, eq(billItems.billId, bills.id))
			.innerJoin(vendors, eq(bills.vendorId, vendors.id))
			.where(
				and(
					eq(billItems.whtApplicable, true),
					sql`${billItems.whtAmount} > 0`,
					gte(bills.invoiceDate, from),
					lte(bills.invoiceDate, to),
					sql`${bills.status} <> ALL (ARRAY['draft'::bill_status, 'cancelled'::bill_status])`,
				),
			);

		const correctionRows: Array<WhtScheduleRow> = await db
			.select({
				rowType: sql<"correction">`'correction'`.as("row_type"),
				remittanceStatus: whtCorrections.remittanceStatus,
				vendor: vendors.name,
				taxPin: vendors.taxPin,
				invoiceNo: bills.invoiceNo,
				invoiceDate: whtCorrections.correctionDate,
				description: whtCorrections.memo,
				grossAmount: sql<null>`NULL`.as("gross_amount"),
				rate: whtCorrectionLines.whtRate,
				whtAmount: whtCorrectionLines.amount,
				certificateNo: bills.whtCertificateNo,
			})
			.from(whtCorrectionLines)
			.innerJoin(
				whtCorrections,
				eq(whtCorrectionLines.correctionId, whtCorrections.id),
			)
			.innerJoin(bills, eq(whtCorrectionLines.billId, bills.id))
			.innerJoin(vendors, eq(bills.vendorId, vendors.id))
			.where(
				and(
					gte(whtCorrections.correctionDate, from),
					lte(whtCorrections.correctionDate, to),
				),
			);

		return [...billingRows, ...correctionRows].sort(compareScheduleRows);
	});
