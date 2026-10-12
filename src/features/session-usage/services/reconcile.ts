import { subDays } from "date-fns";
import { and, eq, gte, inArray, isNotNull, isNull, lte, ne, or, sql } from "drizzle-orm";
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
import { nairobiToday, toNairobiDateString } from "@/lib/nairobi-time";
import { enableAccessForActivatedMembers } from "@/services/member-access";

// Matches the BioTime sync's 30-day fixed lookback (see attendance-sync's
// state/index.ts) plus slack: an expired, never-truncated session membership
// (originalEndDate null) whose endDate is older than this is permanently
// resolved and can be skipped forever by the candidate query below.
const RECENTLY_EXPIRED_WINDOW_DAYS = 35;

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

	// Other currently-relevant (active/pending) memberships for this member.
	// A day already inside one of their windows rightfully belongs to that
	// sibling, not to this membership — without this exclusion, a membership
	// whose window was widened by a restore (originalEndDate set) could claim
	// a day that a newer, overlapping membership already owns, double-counting
	// one real visit as usage on two memberships. Fetched once and reused below
	// for the reactivate-overlap check.
	const siblingMemberships = await tx
		.select({ startDate: memberMemberships.startDate, endDate: memberMemberships.endDate })
		.from(memberMemberships)
		.where(
			and(
				eq(memberMemberships.memberId, membership.memberId),
				ne(memberMemberships.id, membership.id),
				inArray(memberMemberships.status, ["active", "pending"])
			)
		);

	// Days already recorded (non-voided) against some OTHER membership of this
	// member, regardless of that membership's current status. The sibling-window
	// filter above only protects against a currently active/pending sibling's
	// window claiming a day first — it goes blind the moment that sibling later
	// expires (e.g. its own natural lapse, long after it already recorded a
	// usage row for the day in question). This filter catches that case: a day
	// already claimed elsewhere can never become eligible for this membership,
	// no matter what the other membership's status is now. Uses the existing
	// (memberId, usageDate) index on membership_session_usage.
	const claimedElsewhere = await tx
		.select({ usageDate: membershipSessionUsage.usageDate })
		.from(membershipSessionUsage)
		.where(
			and(
				eq(membershipSessionUsage.memberId, membership.memberId),
				ne(membershipSessionUsage.membershipId, membership.id),
				isNull(membershipSessionUsage.voidedAt)
			)
		);
	const claimedDates = new Set(claimedElsewhere.map((row) => row.usageDate));

	const dailyAttendance: DailyAttendanceInput[] = dailyRowsRaw
		.map((row) => ({
			attendanceDate: row.attendanceDate,
			firstAttendanceLogId: row.firstAttendanceLogId,
		}))
		.filter(
			(day) =>
				!claimedDates.has(day.attendanceDate) &&
				!siblingMemberships.some(
					(sibling) =>
						day.attendanceDate >= sibling.startDate &&
						(sibling.endDate === null || day.attendanceDate <= sibling.endDate)
				)
		);

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
			const insertedRows = await tx
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
				})
				.returning({ id: membershipSessionUsage.id });
			outcome.usageInserted += insertedRows.length;
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
			// A restore widens this membership's window back out (originalEndDate
			// is cleared, endDate goes back to action.endDate). If that widened
			// window now overlaps a sibling active/pending membership, flipping
			// this one back to "active" would let it start claiming days that
			// rightfully belong to the sibling on the next reconciliation run —
			// double-consuming the same visit. So when there's an overlap the whole
			// restoration is deferred: endDate and originalEndDate are retained and
			// the membership is left untouched.
			const overlapsAnotherMembership = siblingMemberships.some(
				(sibling) =>
					action.endDate >= sibling.startDate &&
					(sibling.endDate === null || membership.startDate <= sibling.endDate)
			);
			if (overlapsAnotherMembership) {
				console.warn(
					`Session membership ${membership.id} (member ${membership.memberId}) restoration deferred after a waiver — the restored window would overlap another membership. Manual review needed.`
				);
				continue;
			}
			const reactivate = action.reactivate;
			await tx
				.update(memberMemberships)
				.set({
					endDate: action.endDate,
					originalEndDate: null,
					...(reactivate ? { status: "active" as const } : {}),
				})
				.where(eq(memberMemberships.id, membership.id));
			if (actorUserId) {
				await tx.insert(activityLogs).values({
					userId: actorUserId,
					action: "restore session membership",
					description: `Membership ${membership.id} end date restored to ${action.endDate}.`,
				});
			}
			if (reactivate) {
				// Only lifts members the system itself deactivated; manually
				// deactivated/frozen/terminated or soft-deleted members are left alone.
				await enableAccessForActivatedMembers(tx, [membership.memberId], "session_usage_restored");
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
	// Bound the candidate set so a membership that's permanently resolved
	// (expired, never truncated for exhaustion, and long past its endDate)
	// isn't re-queried/locked every night forever for zero effect. A status
	// other than "expired" always needs checking; an expired membership still
	// needs checking if it was truncated for exhaustion (originalEndDate set —
	// a future waiver could still restore it, no matter how old) or if its
	// endDate falls within the recent safety window.
	const recentExpiredCutoff = toNairobiDateString(
		subDays(new Date(nairobiToday(now)), RECENTLY_EXPIRED_WINDOW_DAYS)
	);
	const candidates = await db
		.select({ id: memberMemberships.id, memberId: memberMemberships.memberId })
		.from(memberMemberships)
		.where(
			and(
				sql`${memberMemberships.sessionsTotal} is not null`,
				inArray(memberMemberships.status, ["active", "pending", "expired"]),
				or(
					ne(memberMemberships.status, "expired"),
					isNotNull(memberMemberships.originalEndDate),
					gte(memberMemberships.endDate, recentExpiredCutoff)
				),
				memberIds && memberIds.length > 0
					? inArray(memberMemberships.memberId, memberIds)
					: undefined
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
		try {
			await db.transaction(async (tx) => {
				await lockMemberMembershipCreation(tx, candidate.memberId);
				const outcome = await reconcileOneMembership(tx, candidate.id, { now });
				result.usageInserted += outcome.usageInserted;
				if (outcome.truncated) result.truncated += 1;
				if (outcome.restored) result.restored += 1;
				result.overConsumption.push(
					...outcome.overConsumption.map((usageDate) => ({
						memberId: candidate.memberId,
						usageDate,
					}))
				);
			});
		} catch (error) {
			// Isolate one bad candidate (transient DB error, lock timeout) so it
			// can't abort the whole sweep for every other membership — and, since
			// the nightly cron wraps this call in one try/catch alongside
			// expireExhaustedSessionMemberships, so it can't skip that step either.
			console.error(
				`reconcileOneMembership failed for membership ${candidate.id} (member ${candidate.memberId})`,
				error
			);
		}
	}

	return result;
}
