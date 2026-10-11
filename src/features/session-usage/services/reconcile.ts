import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import {
	activityLogs,
	dailyAttendance as dailyAttendanceView,
	memberMemberships,
	membershipSessionUsage,
} from "@/drizzle/schema";
import type { Transaction } from "@/features/receipts/services/membership-payment-finalizer";
import { lockMemberMembershipCreation } from "@/features/receipts/services/payment.mutations.api";
import {
	type DailyAttendanceInput,
	planSessionReconciliation,
	type UsageRowInput,
} from "@/features/session-usage/lib/reconciliation";
import { nairobiToday } from "@/lib/nairobi-time";
import { enableMemberAccess } from "@/services/member-access";

export type ReconcileSessionUsageResult = {
	membershipsChecked: number;
	usageInserted: number;
	truncated: number;
	restored: number;
	overConsumption: Array<{ memberId: string; usageDate: string }>;
};

type ReconcileOneResult = {
	usageInserted: number;
	truncated: boolean;
	restored: boolean;
	overConsumption: string[];
};

// Re-runs the planner for one membership and applies its actions. The caller
// must already be inside a transaction holding the per-member advisory lock
// (lockMemberMembershipCreation) — this function does neither itself, so the
// manual add/waive server functions can call it right after their own write,
// in the same transaction, without nesting transactions or double-locking.
export async function reconcileOneMembership(
	tx: Transaction,
	membershipId: string,
	{ now = new Date(), actorUserId }: { now?: Date; actorUserId?: string } = {}
): Promise<ReconcileOneResult> {
	const empty: ReconcileOneResult = {
		usageInserted: 0,
		truncated: false,
		restored: false,
		overConsumption: [],
	};

	const membership = await tx.query.memberMemberships.findFirst({
		where: eq(memberMemberships.id, membershipId),
	});
	if (!membership || membership.sessionsTotal === null || !membership.endDate) {
		return empty;
	}
	if (
		membership.status !== "active" &&
		membership.status !== "pending" &&
		membership.status !== "expired"
	) {
		return empty;
	}

	const today = nairobiToday(now);
	const windowEnd = membership.originalEndDate ?? membership.endDate;

	const usageRowsRaw = await tx
		.select({
			id: membershipSessionUsage.id,
			usageDate: membershipSessionUsage.usageDate,
			voidedAt: membershipSessionUsage.voidedAt,
		})
		.from(membershipSessionUsage)
		.where(eq(membershipSessionUsage.membershipId, membershipId));
	const usageRows: UsageRowInput[] = usageRowsRaw.map((row) => ({
		id: row.id,
		usageDate: row.usageDate,
		voidedAt: row.voidedAt,
	}));

	const dailyRowsRaw = await tx
		.select({
			attendanceDate: dailyAttendanceView.attendanceDate,
			firstAttendanceLogId: dailyAttendanceView.firstAttendanceLogId,
		})
		.from(dailyAttendanceView)
		.where(
			and(
				eq(dailyAttendanceView.memberId, membership.memberId),
				gte(dailyAttendanceView.attendanceDate, membership.startDate),
				lte(dailyAttendanceView.attendanceDate, windowEnd)
			)
		);
	const dailyAttendance: DailyAttendanceInput[] = dailyRowsRaw.map((row) => ({
		attendanceDate: row.attendanceDate,
		firstAttendanceLogId: row.firstAttendanceLogId,
	}));

	const actions = planSessionReconciliation({
		membership: {
			id: membership.id,
			memberId: membership.memberId,
			startDate: membership.startDate,
			endDate: membership.endDate,
			originalEndDate: membership.originalEndDate,
			status: membership.status,
			sessionsTotal: membership.sessionsTotal,
		},
		usageRows,
		dailyAttendance,
		today,
	});

	const outcome: ReconcileOneResult = { ...empty };

	for (const action of actions) {
		if (action.type === "insertUsage") {
			await tx
				.insert(membershipSessionUsage)
				.values({
					membershipId: membership.id,
					memberId: membership.memberId,
					usageDate: action.usageDate,
					source: "punch",
					attendanceLogId: action.attendanceLogId,
				})
				.onConflictDoNothing({
					target: [membershipSessionUsage.membershipId, membershipSessionUsage.usageDate],
				});
			outcome.usageInserted += 1;
		} else if (action.type === "truncateEnd") {
			await tx
				.update(memberMemberships)
				.set({ endDate: action.newEndDate, originalEndDate: action.originalEndDate })
				.where(eq(memberMemberships.id, membership.id));
			if (actorUserId) {
				await tx.insert(activityLogs).values({
					userId: actorUserId,
					action: "truncate session membership",
					description: `Membership ${membership.id} exhausted its sessions; end date truncated to ${action.newEndDate}.`,
				});
			}
			outcome.truncated = true;
		} else if (action.type === "restoreEnd") {
			await tx
				.update(memberMemberships)
				.set({
					endDate: action.endDate,
					originalEndDate: null,
					...(action.reactivate ? { status: "active" as const } : {}),
				})
				.where(eq(memberMemberships.id, membership.id));
			if (actorUserId) {
				await tx.insert(activityLogs).values({
					userId: actorUserId,
					action: "restore session membership",
					description: `Membership ${membership.id} end date restored to ${action.endDate}.`,
				});
			}
			if (action.reactivate) {
				await enableMemberAccess(tx, membership.memberId, "session_usage_restored");
			}
			outcome.restored = true;
		} else if (action.type === "overConsumption") {
			outcome.overConsumption.push(action.usageDate);
			console.warn(
				`Session membership ${membership.id} (member ${membership.memberId}) had a punch on ${action.usageDate} after its sessions were exhausted.`
			);
		}
	}

	return outcome;
}

// Full sweep (or a filtered one by memberIds): opens its own transaction + lock
// per membership, so it's safe to call concurrently and repeatedly. Never takes
// an actorUserId — this path has no human actor (see Global Constraints).
export async function reconcileSessionUsage({
	memberIds,
	now = new Date(),
}: { memberIds?: string[]; now?: Date } = {}): Promise<ReconcileSessionUsageResult> {
	const candidates = await db
		.select({ id: memberMemberships.id, memberId: memberMemberships.memberId })
		.from(memberMemberships)
		.where(
			and(
				sql`${memberMemberships.sessionsTotal} is not null`,
				inArray(memberMemberships.status, ["active", "pending", "expired"]),
				memberIds && memberIds.length > 0 ? inArray(memberMemberships.memberId, memberIds) : undefined
			)
		);

	const result: ReconcileSessionUsageResult = {
		membershipsChecked: candidates.length,
		usageInserted: 0,
		truncated: 0,
		restored: 0,
		overConsumption: [],
	};

	for (const candidate of candidates) {
		await db.transaction(async (tx) => {
			await lockMemberMembershipCreation(tx, candidate.memberId);
			const outcome = await reconcileOneMembership(tx, candidate.id, { now });
			result.usageInserted += outcome.usageInserted;
			if (outcome.truncated) result.truncated += 1;
			if (outcome.restored) result.restored += 1;
			result.overConsumption.push(
				...outcome.overConsumption.map((usageDate) => ({ memberId: candidate.memberId, usageDate }))
			);
		});
	}

	return result;
}
