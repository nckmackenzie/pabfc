import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq, gte, isNull, lt, lte } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { employees, enquiries } from "@/drizzle/schema";
import {
	buildEnquiryConversionReport,
	type EnquiryReportRow,
	monthStart,
	nextMonthStart,
	weekStart,
} from "@/features/enquiries/lib/enquiry-report";
import { buildEnquiryReportQuery } from "@/features/enquiries/lib/enquiry-report-queries";
import { isOpenEnquiry, nairobiDayBounds } from "@/features/enquiries/lib/query-filters";
import { enquiryFullName } from "@/features/enquiries/lib/helpers";
import { enquiryConversionFormSchema } from "@/features/enquiries/services/schemas";
import { ApplicationError } from "@/lib/error-handling/app-error";
import { nairobiToday } from "@/lib/nairobi-time";
import { requirePermission } from "@/lib/permissions/permissions";
import { authMiddleware } from "@/middlewares/auth-middleware";

// Read-only. Reads each enquiry's CURRENT state, so a conversion that was voided
// and re-recorded shows its latest convertedAt.
export const getEnquiryConversionReport = createServerFn()
	.middleware([authMiddleware])
	.validator(enquiryConversionFormSchema)
	.handler(async ({ data }) => {
		await requirePermission("enquiries:report");

		const { from, to } = data.dateRange;
		if (!from || !to) throw new ApplicationError("Date range is required");

		const rows = await buildEnquiryReportQuery(db, {
			from,
			to,
			sources: data.source,
			assignedEmployeeId: data.assignedEmployeeId,
		});

		const reportRows: EnquiryReportRow[] = rows.map((row) => ({
			...row,
			paymentTotal: row.paymentTotal === null ? null : Number(row.paymentTotal),
		}));

		return buildEnquiryConversionReport(reportRows, { from, to });
	});

export type EnquiryConversionReportData = Awaited<ReturnType<typeof getEnquiryConversionReport>>;

// Every non-deleted employee, including former ones: enquiries stay assigned to
// staff who have since left, so the report must be able to filter by them.
export const getEnquiryReportStaffOptions = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		await requirePermission("enquiries:report");

		const rows = await db
			.select({ id: employees.id, firstName: employees.firstName, lastName: employees.lastName })
			.from(employees)
			.where(isNull(employees.deletedAt))
			.orderBy(asc(employees.firstName), asc(employees.lastName));

		return rows.map(({ id, firstName, lastName }) => ({
			value: id,
			label: enquiryFullName(firstName, lastName),
		}));
	});

// Dashboard widget. Its own permission (enquiries:view), deliberately not dashboard:view.
// Weeks start on Monday and months on the 1st, both in Nairobi time.
export const getEnquiryDashboardSnapshot = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		await requirePermission("enquiries:view");

		const today = nairobiToday();
		const weekFrom = nairobiDayBounds({ from: weekStart(today) }).start as Date;
		const monthFrom = nairobiDayBounds({ from: monthStart(today) }).start as Date;
		const nextMonthFrom = nairobiDayBounds({ from: nextMonthStart(today) }).start as Date;
		const notDeleted = isNull(enquiries.deletedAt);

		const [newThisWeek, dueToday, overdue, conversionsThisMonth, followUps] = await Promise.all([
			db.$count(enquiries, and(notDeleted, gte(enquiries.createdAt, weekFrom))),
			db.$count(enquiries, and(notDeleted, isOpenEnquiry, eq(enquiries.followUpDate, today))),
			db.$count(enquiries, and(notDeleted, isOpenEnquiry, lt(enquiries.followUpDate, today))),
			db.$count(
				enquiries,
				and(
					notDeleted,
					eq(enquiries.status, "converted"),
					gte(enquiries.convertedAt, monthFrom),
					lt(enquiries.convertedAt, nextMonthFrom)
				)
			),
			db
				.select({
					id: enquiries.id,
					firstName: enquiries.firstName,
					lastName: enquiries.lastName,
					followUpDate: enquiries.followUpDate,
					assignedEmployeeFirstName: employees.firstName,
					assignedEmployeeLastName: employees.lastName,
				})
				.from(enquiries)
				.leftJoin(employees, eq(employees.id, enquiries.assignedEmployeeId))
				.where(and(notDeleted, isOpenEnquiry, lte(enquiries.followUpDate, today)))
				.orderBy(asc(enquiries.followUpDate), asc(enquiries.createdAt))
				.limit(5),
		]);

		return {
			today,
			newThisWeek,
			followUpsDueToday: dueToday,
			followUpsOverdue: overdue,
			conversionsThisMonth,
			followUps: followUps.map((row) => ({
				id: row.id,
				name: enquiryFullName(row.firstName, row.lastName),
				followUpDate: row.followUpDate as string,
				assignedEmployeeName: row.assignedEmployeeFirstName
					? enquiryFullName(row.assignedEmployeeFirstName, row.assignedEmployeeLastName)
					: null,
				overdue: (row.followUpDate as string) < today,
			})),
		};
	});

export type EnquiryDashboardSnapshot = Awaited<ReturnType<typeof getEnquiryDashboardSnapshot>>;
