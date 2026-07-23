import { createFileRoute } from "@tanstack/react-router";
import { addYears, format, isToday, subDays } from "date-fns";
import { and, eq, inArray, isNull, lt, lte, notInArray, or, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import {
	accessControlSyncJobs,
	attendanceLogs,
	bills,
	biotimePersonProfiles,
	financialYears,
	memberMemberships,
	members,
	users,
	vwInvoices,
} from "@/drizzle/schema";
import { getCurrentFinancialYear } from "@/features/financial-years/services/financial-years.api";
import { expireCreditNotes } from "@/features/credit-notes/services/credit-note.maintenance";
import { dateFormat, normalizeDateRange } from "@/lib/helpers";
import { deleteOlderLogs } from "@/services/activity-logger";
import { disableMemberAccessIfNoValidMembership } from "@/services/member-access";

async function autoCreateFinancialYear() {
	const settings = await db.query.settings.findFirst({
		columns: { billing: true },
	});

	if (!settings?.billing?.autoCreateFinancialYear) return;
	const currentFinancialYear = await getCurrentFinancialYear();
	if (!currentFinancialYear) return;

	if (isToday(new Date(currentFinancialYear.endDate))) {
		const newStartDate = addYears(new Date(currentFinancialYear.startDate), 1);
		const newEndDate = addYears(new Date(currentFinancialYear.endDate), 1);

		const { from, to } = normalizeDateRange(newStartDate, newEndDate);

		await db.insert(financialYears).values({
			name: `FY ${format(newStartDate, "yyyy")}`,
			startDate: from,
			endDate: to,
			closed: false,
		});
	}
}

async function runDailyMaintenance() {
	// 1) delete older audit logs
	await deleteOlderLogs();

	// 2) change status of invoices
	const overDueInvoices = await db
		.select({ id: vwInvoices.id })
		.from(vwInvoices)
		.where(
			and(
				sql`${vwInvoices.balance} > 0`,
				lte(vwInvoices.dueDate, sql`CURRENT_DATE`),
				notInArray(vwInvoices.status, ["cancelled", "overdue", "draft"])
			)
		);

	await db
		.update(bills)
		.set({ status: "overdue" })
		.where(
			inArray(
				bills.id,
				overDueInvoices.map((i) => i.id)
			)
		);

	// 3) auto create financial year
	await autoCreateFinancialYear();

	// 4) update membership status rollovers
	await expireMembershipsAndDisableAccess();

	// 5) deactivate inactive members
	await deactivateInactiveMembers();

	// 6) write off expired, unredeemed credit note balances
	await expireCreditNotes();
}

async function deactivateInactiveMembers() {
	const settingsData = await db.query.settings.findFirst({
		columns: { data: true },
	});
	const inactiveDays = settingsData?.data?.inactiveMemberDays ?? 90;
	const thresholdDate = subDays(new Date(), inactiveDays);

	const lastAttendanceSubquery = db
		.select({
			memberId: attendanceLogs.memberId,
			lastCheckIn: sql<Date>`max(${attendanceLogs.checkInTime})`.as("last_check_in"),
		})
		.from(attendanceLogs)
		.groupBy(attendanceLogs.memberId)
		.as("last_attendance");

	const today = dateFormat(new Date());

	const membersWithActiveSubscription = db
		.select({ memberId: memberMemberships.memberId })
		.from(memberMemberships)
		.where(
			and(
				eq(memberMemberships.status, "active"),
				or(isNull(memberMemberships.endDate), sql`${memberMemberships.endDate} >= ${today}`)
			)
		);

	const membersToDeactivate = await db
		.select({
			id: members.id,
			memberNo: members.memberNo,
			firstName: members.firstName,
			lastName: members.lastName,
			profileId: biotimePersonProfiles.id,
			biotimeEmployeeId: biotimePersonProfiles.biotimeEmployeeId,
			unauthorizedAreaId: biotimePersonProfiles.unauthorizedAreaId,
		})
		.from(members)
		.leftJoin(lastAttendanceSubquery, eq(members.id, lastAttendanceSubquery.memberId))
		.leftJoin(biotimePersonProfiles, eq(members.id, biotimePersonProfiles.memberId))
		.where(
			and(
				eq(members.memberStatus, "active"),
				isNull(members.deletedAt),
				notInArray(members.id, membersWithActiveSubscription),
				or(
					lte(lastAttendanceSubquery.lastCheckIn, thresholdDate),
					and(isNull(lastAttendanceSubquery.lastCheckIn), lte(members.createdAt, thresholdDate))
				)
			)
		);

	if (membersToDeactivate.length === 0) {
		return;
	}

	const now = new Date();

	await db.transaction(async (tx) => {
		for (const member of membersToDeactivate) {
			// 1) Update member status to inactive
			await tx
				.update(members)
				.set({
					memberStatus: "inactive",
					deactivatedAt: now,
					updatedAt: now,
				})
				.where(eq(members.id, member.id));

			// 2) Update user status to inactive
			await tx
				.update(users)
				.set({
					active: false,
					deactivatedAt: now,
					updatedAt: now,
				})
				.where(eq(users.memberId, member.id));

			// 3) Update access profile if exists
			if (member.profileId) {
				await tx
					.update(biotimePersonProfiles)
					.set({
						desiredAccessEnabled: false,
						accessControlStatus: "pending_sync",
						updatedAt: now,
					})
					.where(eq(biotimePersonProfiles.id, member.profileId));

				if (member.biotimeEmployeeId !== null && member.biotimeEmployeeId !== undefined) {
					// 4) Insert access control sync job
					await tx.insert(accessControlSyncJobs).values({
						memberId: member.id,
						biotimePersonProfileId: member.profileId,
						personType: "member",
						action: "DISABLE_ACCESS",
						status: "pending",
						payload: {
							biotimeEmployeeId: member.biotimeEmployeeId,
							areaIds: [member.unauthorizedAreaId ?? 1],
							reason: "inactive_member",
						},
						idempotencyKey: `DISABLE_ACCESS:${member.id}:${Date.now()}`,
					});
				}
			}
		}
	});
}

async function expireMembershipsAndDisableAccess() {
	const today = dateFormat(new Date());
	const now = new Date();

	await db.transaction(async (tx) => {
		// 1) Expire memberships and return affected members
		const expiredMemberships = await tx
			.update(memberMemberships)
			.set({
				status: "expired",
				updatedAt: now,
			})
			.where(and(eq(memberMemberships.status, "active"), lt(memberMemberships.endDate, today)))
			.returning({
				memberId: memberMemberships.memberId,
			});

		if (expiredMemberships.length === 0) return;

		const affectedMemberIds = [...new Set(expiredMemberships.map((m) => m.memberId))];

		for (const memberId of affectedMemberIds) {
			await disableMemberAccessIfNoValidMembership(tx, memberId, "membership_expired");
		}
	});
}

export const Route = createFileRoute("/api/cron/daily/")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const authHeader = request.headers.get("authorization");
				const expected = process.env.CRON_SECRET;

				if (!expected || authHeader !== `Bearer ${expected}`) {
					return new Response("Unauthorized", {
						status: 401,
					});
				}

				await runDailyMaintenance();
				return Response.json({ success: true });
			},
		},
	},
});
