import { createServerFn } from "@tanstack/react-start";
import { and, asc, desc, eq, getTableColumns, isNull, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { employees, enquiries, membershipPlans } from "@/drizzle/schema";
import { buildEnquiryFilters } from "@/features/enquiries/lib/query-filters";
import { findEnquiryDuplicates } from "@/features/enquiries/services/enquiry-duplicates";
import {
	checkEnquiryDuplicatesSchema,
	enquiryValidateSearch,
} from "@/features/enquiries/services/schemas";
import { nairobiToday } from "@/lib/nairobi-time";
import { requireAnyPermission, requirePermission } from "@/lib/permissions/permissions";
import { toTitleCase } from "@/lib/utils";
import { authMiddleware } from "@/middlewares/auth-middleware";

const assignedEmployeeName = sql<
	string | null
>`nullif(concat_ws(' ', ${employees.firstName}, ${employees.lastName}), '')`;

export const getEnquiries = createServerFn()
	.middleware([authMiddleware])
	.validator(enquiryValidateSearch)
	.handler(async ({ data }) => {
		await requirePermission("enquiries:view");

		return db
			.select({
				id: enquiries.id,
				firstName: enquiries.firstName,
				lastName: enquiries.lastName,
				phone: enquiries.phone,
				email: enquiries.email,
				source: enquiries.source,
				status: enquiries.status,
				followUpDate: enquiries.followUpDate,
				smsConsent: enquiries.smsConsent,
				createdAt: enquiries.createdAt,
				interestedPlanId: enquiries.interestedPlanId,
				interestedPlanName: membershipPlans.name,
				assignedEmployeeId: enquiries.assignedEmployeeId,
				assignedEmployeeName,
			})
			.from(enquiries)
			.leftJoin(membershipPlans, eq(membershipPlans.id, enquiries.interestedPlanId))
			.leftJoin(employees, eq(employees.id, enquiries.assignedEmployeeId))
			.where(and(...buildEnquiryFilters(data, nairobiToday())))
			.orderBy(desc(enquiries.createdAt));
	});

export type EnquiryListItem = Awaited<ReturnType<typeof getEnquiries>>[number];

export const getEnquiry = createServerFn()
	.middleware([authMiddleware])
	.validator((enquiryId: string) => enquiryId)
	.handler(async ({ data: enquiryId }) => {
		await requireAnyPermission(["enquiries:view", "enquiries:update"]);

		const [enquiry] = await db
			.select({
				...getTableColumns(enquiries),
				interestedPlanName: membershipPlans.name,
				assignedEmployeeName,
			})
			.from(enquiries)
			.leftJoin(membershipPlans, eq(membershipPlans.id, enquiries.interestedPlanId))
			.leftJoin(employees, eq(employees.id, enquiries.assignedEmployeeId))
			.where(and(eq(enquiries.id, enquiryId), isNull(enquiries.deletedAt)))
			.limit(1);

		return enquiry ?? null;
	});

export type EnquiryDetail = NonNullable<Awaited<ReturnType<typeof getEnquiry>>>;

export const checkEnquiryDuplicates = createServerFn()
	.middleware([authMiddleware])
	.validator(checkEnquiryDuplicatesSchema)
	.handler(async ({ data }) => {
		await requireAnyPermission(["enquiries:create", "enquiries:update"]);
		return findEnquiryDuplicates(db, data);
	});

// Plans an enquirer can be interested in: active, non-guest-pass. Scoped to the
// enquiries permissions because getPlans (plans module) does not allow them.
export const getEnquiryPlanOptions = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		await requireAnyPermission(["enquiries:view", "enquiries:create", "enquiries:update"]);

		const plans = await db
			.select({ id: membershipPlans.id, name: membershipPlans.name })
			.from(membershipPlans)
			.where(and(eq(membershipPlans.active, true), eq(membershipPlans.isGuestPass, false)))
			.orderBy(asc(sql`lower(${membershipPlans.name})`));

		return plans.map(({ id, name }) => ({ value: id, label: toTitleCase(name) }));
	});

// Active employees only. Guarded by the enquiries permissions rather than
// employees:view so front-desk staff can assign enquiries without HR access.
export const getAssignableEmployees = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		await requireAnyPermission(["enquiries:view", "enquiries:create", "enquiries:update"]);

		const rows = await db
			.select({
				id: employees.id,
				firstName: employees.firstName,
				lastName: employees.lastName,
				jobTitle: employees.jobTitle,
			})
			.from(employees)
			.where(and(eq(employees.status, "active"), isNull(employees.deletedAt)))
			.orderBy(asc(employees.firstName), asc(employees.lastName));

		return rows.map(({ id, firstName, lastName, jobTitle }) => ({
			id,
			name: `${firstName} ${lastName}`,
			jobTitle,
		}));
	});
