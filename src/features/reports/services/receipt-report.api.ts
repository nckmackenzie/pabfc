import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq, exists, gte, lte, type SQL, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { members, paymentMembers, payments } from "@/drizzle/schema";
import { ApplicationError } from "@/lib/error-handling/app-error";
import { normalizeDateRange } from "@/lib/helpers";
import { requirePermission } from "@/lib/permissions/permissions";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { receiptReportFormSchema } from "./schema";

export const getReceiptReport = createServerFn()
	.middleware([authMiddleware])
	.validator(receiptReportFormSchema)
	.handler(async ({ data }) => {
		await requirePermission("reports:receipts-report");

		const { dateRange, reportType, memberId } = data;

		const filters: Array<SQL> = [];

		if (!dateRange.from || !dateRange.to)
			throw new ApplicationError("Date range is required");

		const { from, to } = normalizeDateRange(dateRange.from, dateRange.to, true);

		if (reportType === "by-member") {
			if (!memberId) throw new ApplicationError("Member is required");
			// A group payment covers members beyond the billing member (payments.memberId),
			// so match against payment_members rather than the billing member alone.
			filters.push(
				exists(
					db
						.select({ id: paymentMembers.id })
						.from(paymentMembers)
						.where(
							and(eq(paymentMembers.paymentId, payments.id), eq(paymentMembers.memberId, memberId))
						)
				)
			);
		}

		return db
			.select({
				paymentDate: payments.paymentDate,
				fullName: sql<string>`CONCAT(${members.firstName}, ' ', ${members.lastName})`,
				reference: payments.reference,
				amount: payments.amount,
				paymentMethod: payments.method,
				discount: payments.discountedAmount,
				taxAmount: payments.taxAmount,
				totalAmount: payments.totalAmount,
			})
			.from(payments)
			.innerJoin(members, eq(payments.memberId, members.id))
			.where(
				and(
					gte(payments.paymentDate, from),
					lte(payments.paymentDate, to),
					...filters,
				),
			)
			.orderBy(asc(payments.paymentDate));
	});
