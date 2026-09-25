import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { billItems, bills, vendors } from "@/drizzle/schema";
import { requirePermission } from "@/lib/permissions/permissions";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { whtScheduleFormSchema } from "@/features/reports/services/schema";

/**
 * Every withholding deduction made in a period, one row per bill line, ordered so
 * that rows withheld at the same rate sit together. This is the schedule the KRA
 * return is filed from, so the rate and base are reported exactly as they were
 * stored on the bill rather than recomputed here.
 *
 * Draft and cancelled bills are excluded: nothing was withheld on a bill that was
 * never posted.
 */
export const getWhtSchedule = createServerFn()
	.middleware([authMiddleware])
	.validator(whtScheduleFormSchema)
	.handler(async ({ data }) => {
		await requirePermission("reports:wht-schedule");
		const { from, to } = data.dateRange;

		return db
			.select({
				vendor: vendors.name,
				taxPin: vendors.taxPin,
				invoiceNo: bills.invoiceNo,
				invoiceDate: bills.invoiceDate,
				description: billItems.description,
				/** The VAT-exclusive value the rate was applied to. */
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
			)
			.orderBy(
				asc(billItems.whtRate),
				asc(vendors.name),
				asc(bills.invoiceDate),
				asc(bills.invoiceNo),
			);
	});
