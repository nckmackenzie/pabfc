import { and, asc, eq, exists, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import {
	activityLogs,
	biotimePersonProfiles,
	memberMemberships,
	members,
	users,
	type MemberStatus,
} from "@/drizzle/schema";
import type { Transaction } from "@/features/receipts/services/membership-payment-finalizer";
import { disableMemberAccess, enableMemberAccess } from "@/services/member-access";

export type MemberStateInput = {
	memberId: string;
	memberStatus: MemberStatus;
	deletedAt: Date | null;
	// null when the member has no BioTime profile, so there is nothing to toggle.
	desiredAccessEnabled: boolean | null;
	hasActiveMembership: boolean;
};

export type MemberStatePlan = {
	memberId: string;
	statusChange?: "active" | "inactive";
	accessChange?: "enable" | "disable";
};

// A member is "current" when they hold an active membership. Status and door
// access both follow that: only active/inactive members are ever moved, and
// access is wanted exactly when the member is current and ends up active.
export function planMemberStateChanges(rows: MemberStateInput[]): MemberStatePlan[] {
	const plans: MemberStatePlan[] = [];

	for (const row of rows) {
		if (row.deletedAt) continue;
		if (row.memberStatus !== "active" && row.memberStatus !== "inactive") continue;

		const resultingStatus = row.hasActiveMembership ? "active" : "inactive";
		const wantsAccess = row.hasActiveMembership && resultingStatus === "active";

		const plan: MemberStatePlan = { memberId: row.memberId };
		if (resultingStatus !== row.memberStatus) plan.statusChange = resultingStatus;
		if (row.desiredAccessEnabled !== null && row.desiredAccessEnabled !== wantsAccess) {
			plan.accessChange = wantsAccess ? "enable" : "disable";
		}

		if (plan.statusChange || plan.accessChange) plans.push(plan);
	}

	return plans;
}

export type ReconcileMemberStateResult = {
	activated: number;
	deactivated: number;
	accessEnabled: number;
	accessDisabled: number;
	failed: number;
};

const emptyResult = (): ReconcileMemberStateResult => ({
	activated: 0,
	deactivated: 0,
	accessEnabled: 0,
	accessDisabled: 0,
	failed: 0,
});

async function loadMemberStateInputs(executor: Pick<typeof db, "select">, memberIds?: string[]) {
	return executor
		.select({
			memberId: members.id,
			memberStatus: members.memberStatus,
			deletedAt: members.deletedAt,
			desiredAccessEnabled: biotimePersonProfiles.desiredAccessEnabled,
			hasActiveMembership: sql<boolean>`${exists(
				executor
					.select({ id: memberMemberships.id })
					.from(memberMemberships)
					.where(
						and(eq(memberMemberships.memberId, members.id), eq(memberMemberships.status, "active"))
					)
			)}`,
		})
		.from(members)
		.leftJoin(
			biotimePersonProfiles,
			and(eq(biotimePersonProfiles.memberId, members.id), eq(biotimePersonProfiles.personType, "member"))
		)
		.where(
			and(
				isNull(members.deletedAt),
				memberIds ? inArray(members.id, memberIds) : undefined
			)
		);
}

async function applyStatusChanges(
	tx: Transaction,
	status: "active" | "inactive",
	memberIds: string[]
) {
	if (memberIds.length === 0) return;
	const now = new Date();
	const deactivatedAt = status === "active" ? null : now;

	await tx
		.update(members)
		.set({ memberStatus: status, deactivatedAt, updatedAt: now })
		.where(inArray(members.id, memberIds));
	await tx
		.update(users)
		.set({ active: status === "active", deactivatedAt, updatedAt: now })
		.where(inArray(users.memberId, memberIds));
}

// Activity logs need a user. Event-driven calls pass the acting staff member;
// the nightly cron has none, so it falls back to the oldest admin account.
async function resolveLogUserId(actorUserId?: string) {
	if (actorUserId) return actorUserId;
	const admin = await db.query.users.findFirst({
		columns: { id: true },
		where: eq(users.role, "admin"),
		orderBy: asc(users.createdAt),
	});
	return admin?.id ?? null;
}

async function logReconcile(
	plans: MemberStatePlan[],
	result: ReconcileMemberStateResult,
	{ actorUserId, summary }: { actorUserId?: string; summary: boolean }
) {
	const statusPlans = plans.filter((plan) => plan.statusChange);
	if (statusPlans.length === 0 && !summary) return;

	const userId = await resolveLogUserId(actorUserId);
	if (!userId) return;

	if (summary) {
		await db.insert(activityLogs).values({
			userId,
			action: "reconcile member status",
			description: `Nightly member status sync: ${result.activated} activated, ${result.deactivated} deactivated, ${result.accessEnabled} access enabled, ${result.accessDisabled} access disabled, ${result.failed} failed.`,
		});
		return;
	}

	await db.insert(activityLogs).values(
		statusPlans.map((plan) => ({
			userId,
			action: "reconcile member status",
			description: `Member ${plan.memberId} marked ${plan.statusChange} because ${
				plan.statusChange === "active" ? "they now have" : "they no longer have"
			} an active membership.`,
		}))
	);
}

/**
 * Brings members' status and door access in line with their memberships.
 * Omitting `memberIds` sweeps every non-deleted member (the nightly backfill).
 * Never throws: failures are logged so the operation that triggered the
 * reconcile is never failed by it, and the next nightly sweep retries.
 */
export async function reconcileMemberState({
	memberIds,
	tx,
	actorUserId,
	logSummary = false,
}: {
	memberIds?: string[];
	tx?: Transaction;
	actorUserId?: string;
	/** One summary entry instead of one per status change (nightly sweep). */
	logSummary?: boolean;
} = {}): Promise<ReconcileMemberStateResult> {
	const result = emptyResult();
	if (memberIds && memberIds.length === 0) return result;

	try {
		const ids = memberIds ? [...new Set(memberIds)] : undefined;
		const rows = await loadMemberStateInputs(tx ?? db, ids);
		const plans = planMemberStateChanges(rows);

		const run = async (executor: Transaction) => {
			await applyStatusChanges(
				executor,
				"active",
				plans.filter((plan) => plan.statusChange === "active").map((plan) => plan.memberId)
			);
			await applyStatusChanges(
				executor,
				"inactive",
				plans.filter((plan) => plan.statusChange === "inactive").map((plan) => plan.memberId)
			);
		};
		if (tx) await run(tx);
		else await db.transaction(run);

		for (const plan of plans) {
			if (plan.statusChange === "active") result.activated++;
			if (plan.statusChange === "inactive") result.deactivated++;
		}

		// Access goes through the shared helpers so the BioTime job and profile
		// bookkeeping stay in one place. The planner only asks for a change when
		// the profile disagrees, so nothing is queued when it already matches.
		for (const plan of plans) {
			if (!plan.accessChange) continue;
			try {
				const apply = (executor: Transaction) =>
					plan.accessChange === "enable"
						? enableMemberAccess(executor, plan.memberId, "membership_activated")
						: disableMemberAccess(executor, plan.memberId, "no_active_membership");
				if (tx) await apply(tx);
				else await db.transaction(apply);
				if (plan.accessChange === "enable") result.accessEnabled++;
				else result.accessDisabled++;
			} catch (error) {
				result.failed++;
				console.error(`Failed to ${plan.accessChange} access for member ${plan.memberId}`, error);
			}
		}

		await logReconcile(plans, result, { actorUserId, summary: logSummary });
	} catch (error) {
		result.failed++;
		console.error("Member state reconciliation failed", error);
	}

	return result;
}
