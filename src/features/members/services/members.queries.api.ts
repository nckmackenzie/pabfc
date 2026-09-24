import { createServerFn } from "@tanstack/react-start";
import { and, asc, desc, eq, ilike, isNull, ne, or, type SQL, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/drizzle/db";
import {
	addonInvoices,
	attendanceLogs,
	memberMemberships,
	members,
	membershipPlans,
	membersOverview,
	paymentMembers,
	payments,
} from "@/drizzle/schema";
import { memberValidateSearch } from "@/features/members/services/schemas";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { requirePermission } from "@/lib/permissions/permissions";
import { toTitleCase } from "@/lib/utils";

export const getMembers = createServerFn()
	.validator(memberValidateSearch)
	.handler(async ({ data: { q, status, plan } }) => {
		const filters: Array<SQL> = [];

		if (q) {
			const searchFilters = or(
				ilike(membersOverview.firstName, `%${q}%`),
				ilike(membersOverview.lastName, `%${q}%`),
				ilike(membersOverview.fullName, `%${q}%`),
				ilike(membersOverview.contact, `%${q}%`),
				ilike(sql`CAST(${membersOverview.memberNo} AS TEXT)`, `%${q}%`),
				ilike(sql`CAST(${membersOverview.gender} AS TEXT)`, `%${q}%`),
				ilike(sql`CAST(${membersOverview.memberStatus} AS TEXT)`, `%${q}%`)
			);
			if (searchFilters) {
				filters.push(searchFilters);
			}
		}
		if (status && status !== "all") {
			filters.push(eq(membersOverview.memberStatus, status));
		}
		if (plan && plan !== "all") {
			filters.push(eq(membersOverview.activePlanName, plan));
		}

		return db
			.select({
				id: membersOverview.id,
				memberNo: membersOverview.memberNo,
				fullName: membersOverview.fullName,
				contact: membersOverview.contact,
				gender: membersOverview.gender,
				memberStatus: membersOverview.memberStatus,
				image: membersOverview.image,
				activePlanName: membersOverview.activePlanName,
				nextRenewalDate: membersOverview.nextRenewalDate,
				lastVisit: membersOverview.lastVisit,
				portalAccess: membersOverview.banned,
				fullyRegistered: membersOverview.completedRegistration,
			})
			.from(membersOverview)
			.where(and(...filters))
			.orderBy(desc(membersOverview.memberNo));
	});

export const getActiveMembers = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		await requirePermission("members:view");
		return db.query.members
			.findMany({
				columns: { id: true, firstName: true, lastName: true },
				where: and(eq(members.memberStatus, "active"), isNull(members.deletedAt)),
				orderBy: [
					asc(sql`lower(${members.firstName})`),
					asc(sql`lower(${members.lastName})`),
					asc(members.id),
				],
			})
			.then((m) =>
				m.map(({ id, firstName, lastName }) => ({
					value: id,
					label: toTitleCase(`${firstName} ${lastName}`),
				}))
			);
	});

export const getMemberProfileData = createServerFn()
	.middleware([authMiddleware])
	.validator((memberId: string) => memberId)
	.handler(async ({ data: memberId }) => {
		const member = await db.select().from(membersOverview).where(eq(membersOverview.id, memberId));
		return member[0];
	});

export const checkColumnExists = createServerFn()
	.validator((data: { column: "contact" | "idNo"; value: string; memberId?: string }) => data)
	.handler(async ({ data }) => {
		const filter: Array<SQL> = [];
		if (data.column === "contact") {
			filter.push(eq(members.contact, data.value));
		}
		if (data.column === "idNo") {
			filter.push(eq(members.idNumber, data.value));
		}
		if (data.memberId) {
			filter.push(ne(members.id, data.memberId));
		}

		return db.query.members.findFirst({
			where: and(...filter),
		});
	});

export const getMemberNo = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		return db
			.select({
				memberNo: sql<number>`COALESCE(MAX(${members.memberNo}), 1000)`,
			})
			.from(members)
			.then((res) => res[0].memberNo + 1);
	});

export const getMember = createServerFn()
	.middleware([authMiddleware])
	.validator((memberId: string) => memberId)
	.handler(async ({ data: memberId }) => {
		return db.query.members.findFirst({
			columns: { createdAt: false, updatedAt: false },
			where: and(eq(members.id, memberId), isNull(members.deletedAt)),
		});
	});

export const getMemberPreviousPlanDetails = createServerFn()
	.validator((data: string) => data)
	.handler(async ({ data: memberId }) => {
		const plan = await db.query.memberMemberships.findFirst({
			columns: { createdAt: false, updatedAt: false },
			with: { membershipPlan: { columns: { name: true } } },
			where: eq(memberMemberships.memberId, memberId),
			orderBy: desc(memberMemberships.endDate),
		});
		return plan ?? null;
	});

const PROFILE_HISTORY_LIMIT = 10;

export const getMemberPaymentHistory = createServerFn()
	.middleware([authMiddleware])
	.validator(z.string().min(1, "Member id is required"))
	.handler(async ({ data: memberId }) => {
		await requirePermission("members:view-profile");

		// A member can be the billing member on a payment or one of the members it
		// covers (group payments), so both have to be matched.
		const membershipRows = await db
			.select({
				id: payments.id,
				type: sql<"membership">`'membership'`,
				paymentNo: payments.paymentNo,
				plan: sql<string | null>`${membershipPlans.name}`,
				amount: payments.totalAmount,
				paymentDate: payments.paymentDate,
				status: payments.status,
			})
			.from(payments)
			.innerJoin(membershipPlans, eq(payments.planId, membershipPlans.id))
			.where(
				or(
					eq(payments.memberId, memberId),
					sql`exists (select 1 from ${paymentMembers} where ${paymentMembers.paymentId} = ${payments.id} and ${paymentMembers.memberId} = ${memberId})`
				)
			)
			.orderBy(desc(payments.paymentDate))
			.limit(PROFILE_HISTORY_LIMIT);

		// Addon-only receipts live solely in addon_invoices (see getPayments).
		const addonRows = await db
			.select({
				id: addonInvoices.id,
				type: sql<"addon">`'addon'`,
				paymentNo: addonInvoices.invoiceNo,
				plan: sql<string | null>`NULL`,
				amount: addonInvoices.totalAmount,
				paymentDate: addonInvoices.paymentDate,
				status: addonInvoices.status,
			})
			.from(addonInvoices)
			.where(and(eq(addonInvoices.memberId, memberId), isNull(addonInvoices.paymentId)))
			.orderBy(desc(addonInvoices.paymentDate))
			.limit(PROFILE_HISTORY_LIMIT);

		return [...membershipRows, ...addonRows]
			.sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())
			.slice(0, PROFILE_HISTORY_LIMIT);
	});

export const getMemberAttendanceHistory = createServerFn()
	.middleware([authMiddleware])
	.validator(z.string().min(1, "Member id is required"))
	.handler(async ({ data: memberId }) => {
		await requirePermission("members:view-profile");

		return db
			.select({
				id: sql<string>`${attendanceLogs.id}::text`,
				checkInTime: attendanceLogs.checkInTime,
				checkOutTime: attendanceLogs.checkOutTime,
				/** Session length in minutes. Null until the member checks out. */
				duration: sql<number | null>`
					extract(epoch from (${attendanceLogs.checkOutTime} - ${attendanceLogs.checkInTime})) / 60
				`.mapWith((value) => (value === null ? null : Number(value))),
			})
			.from(attendanceLogs)
			.where(eq(attendanceLogs.memberId, memberId))
			.orderBy(desc(attendanceLogs.checkInTime), desc(attendanceLogs.id))
			.limit(PROFILE_HISTORY_LIMIT);
	});

export type MemberOverview = Awaited<ReturnType<typeof getMembers>>[number];
