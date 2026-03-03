import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { billPaymentLines, billPayments, vendors } from "@/drizzle/schema";
import { ApplicationError } from "@/lib/error-handling/app-error";
import { normalizeDateRange } from "@/lib/helpers";
import { requirePermission } from "@/lib/permissions/permissions";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { paymentsReportFormSchema } from "./schema";

export const getPaymentsReport = createServerFn()
	.middleware([authMiddleware])
	.inputValidator(paymentsReportFormSchema)
	.handler(async ({ data }) => {
		await requirePermission("reports:payments-report");

		const { dateRange, vendorId } = data;
		if (!dateRange.from || !dateRange.to) {
			throw new ApplicationError("Date range is required");
		}

		const { from, to } = normalizeDateRange(dateRange.from, dateRange.to);

		return db
			.select({
				paymentDate: billPayments.paymentDate,
				paymentNo: billPayments.paymentNo,
				vendor: vendors.name,
				amount: sql<string>`coalesce(sum(${billPaymentLines.amount}), 0)`.as(
					"amount",
				),
				paymentMethod: billPayments.paymentMethod,
				reference: billPayments.reference,
			})
			.from(billPayments)
			.innerJoin(vendors, eq(vendors.id, billPayments.vendorId))
			.leftJoin(
				billPaymentLines,
				eq(billPaymentLines.billPaymentId, billPayments.id),
			)
			.where(
				and(
					gte(billPayments.paymentDate, from),
					lte(billPayments.paymentDate, to),
					vendorId !== "all" ? eq(vendors.id, vendorId) : undefined,
				),
			)
			.groupBy(
				billPayments.id,
				billPayments.paymentDate,
				billPayments.paymentNo,
				vendors.name,
				billPayments.paymentMethod,
				billPayments.reference,
			)
			.orderBy(asc(billPayments.paymentDate), asc(billPayments.paymentNo));
	});
