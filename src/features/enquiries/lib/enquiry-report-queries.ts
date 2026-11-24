import { and, eq, inArray, isNotNull, isNull, or, type SQL, sql } from "drizzle-orm";
import type { db } from "@/drizzle/db";
import { employees, type EnquirySource, enquiries, payments } from "@/drizzle/schema";
import { type ReportRange, UNASSIGNED_FILTER } from "@/features/enquiries/lib/enquiry-report";
import { NAIROBI_TZ } from "@/lib/nairobi-time";

// Both enquiries.createdAt and enquiries.convertedAt are `timestamptz`
// (convertedAt copies payments.paymentDate, also timestamptz), so both are
// converted to a Nairobi calendar date before they are compared or bucketed.
const nairobiDate = (column: typeof enquiries.createdAt | typeof enquiries.convertedAt) =>
	// Cast explicitly: an untyped bind parameter could be read as text or interval.
	sql`(${column} AT TIME ZONE ${NAIROBI_TZ}::text)::date`;

export const createdDay = sql<string>`${nairobiDate(enquiries.createdAt)}::text`;
export const convertedDay = sql<string | null>`${nairobiDate(enquiries.convertedAt)}::text`;

export type EnquiryReportFilters = ReportRange & {
	sources?: EnquirySource[];
	// An employee id, or UNASSIGNED_FILTER for enquiries with no assigned staff.
	assignedEmployeeId?: string;
};

// Which enquiries the report needs, in ONE query:
//   cohort   = created in the range (Nairobi date), or
//   activity = currently converted, with convertedAt in the range.
// The aggregator then decides which measure each row feeds. Source and staff
// filters narrow both measures; deleted enquiries are never included.
export function reportRowsFilter({
	from,
	to,
	sources,
	assignedEmployeeId,
}: EnquiryReportFilters): SQL | undefined {
	const createdInRange = and(
		sql`${nairobiDate(enquiries.createdAt)} >= ${from}::date`,
		sql`${nairobiDate(enquiries.createdAt)} <= ${to}::date`
	);
	const convertedInRange = and(
		eq(enquiries.status, "converted"),
		isNotNull(enquiries.convertedAt),
		sql`${nairobiDate(enquiries.convertedAt)} >= ${from}::date`,
		sql`${nairobiDate(enquiries.convertedAt)} <= ${to}::date`
	);

	return and(
		isNull(enquiries.deletedAt),
		sources && sources.length > 0 ? inArray(enquiries.source, sources) : undefined,
		assignedEmployeeId
			? assignedEmployeeId === UNASSIGNED_FILTER
				? isNull(enquiries.assignedEmployeeId)
				: eq(enquiries.assignedEmployeeId, assignedEmployeeId)
			: undefined,
		or(createdInRange, convertedInRange)
	);
}

// How many (non-deleted) enquiries the converting payment converted. Written
// out in full, with the outer column fully qualified, so the alias can't shadow it.
const paymentEnquiryCount = sql<number>`(
	select count(*)::int from "enquiries" e2
	where e2."converted_payment_id" = "enquiries"."converted_payment_id"
	and e2."deleted_at" is null
)`;

// Takes the executor so tests can build the same statement without a database.
export function buildEnquiryReportQuery(
	executor: Pick<typeof db, "select">,
	filters: EnquiryReportFilters
) {
	return executor
		.select({
			id: enquiries.id,
			source: enquiries.source,
			status: enquiries.status,
			lostReason: enquiries.lostReason,
			assignedEmployeeId: enquiries.assignedEmployeeId,
			assignedEmployeeName: sql<
				string | null
			>`nullif(concat_ws(' ', ${employees.firstName}, ${employees.lastName}), '')`,
			createdDay,
			convertedDay,
			directRegistration: sql<boolean>`(${enquiries.status} = 'converted' and ${enquiries.registeredAt} is null)`,
			paymentTotal: payments.totalAmount,
			paymentEnquiryCount,
		})
		.from(enquiries)
		.leftJoin(employees, eq(employees.id, enquiries.assignedEmployeeId))
		.leftJoin(payments, eq(payments.id, enquiries.convertedPaymentId))
		.where(reportRowsFilter(filters));
}
