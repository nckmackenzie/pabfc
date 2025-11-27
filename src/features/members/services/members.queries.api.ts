import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, ilike, ne, or, type SQL, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { members, membersOverview } from "@/drizzle/schema";
import { memberValidateSearch } from "@/features/members/services/schemas";
import { permissionsMiddleware } from "@/middlewares/permission-middleware";

export const getMembers = createServerFn()
	.middleware([permissionsMiddleware(["members:view"])])
	.inputValidator(memberValidateSearch)
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
				ilike(sql`CAST(${membersOverview.memberStatus} AS TEXT)`, `%${q}%`),
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
			})
			.from(membersOverview)
			.where(and(...filters))
			.orderBy(desc(membersOverview.memberNo));
	});

export const checkColumnExists = createServerFn()
	.inputValidator(
		(data: { column: "contact" | "idNo"; value: string; memberId?: string }) =>
			data,
	)
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
	.middleware([permissionsMiddleware(["members:create"])])
	.handler(async () => {
		return db
			.select({
				memberNo: sql<number>`COALESCE(MAX(${members.memberNo}), 1000)`,
			})
			.from(members)
			.then((res) => res[0].memberNo + 1);
	});

export type MemberOverview = Awaited<ReturnType<typeof getMembers>>[number];
