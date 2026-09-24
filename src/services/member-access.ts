import { and, eq, inArray, isNull } from "drizzle-orm";
import {
	accessControlSyncJobs,
	biotimePersonProfiles,
	memberMemberships,
	members,
	users,
} from "@/drizzle/schema";
import type { Transaction } from "@/features/receipts/services/membership-payment-finalizer";

type DisableAccessReason = "membership_expired" | "credit_note_termination" | "manual_deactivation";
type EnableAccessReason = "membership_activated" | "manual_activation";

async function getMemberAccessProfile(tx: Transaction, memberId: string) {
	const [row] = await tx
		.select({
			profileId: biotimePersonProfiles.id,
			biotimeEmployeeId: biotimePersonProfiles.biotimeEmployeeId,
			authorizedAreaId: biotimePersonProfiles.authorizedAreaId,
			unauthorizedAreaId: biotimePersonProfiles.unauthorizedAreaId,
		})
		.from(members)
		.leftJoin(biotimePersonProfiles, eq(members.id, biotimePersonProfiles.memberId))
		.where(eq(members.id, memberId))
		.limit(1);
	return row;
}

// The key is unique across the whole jobs table, so it must include the time:
// a key of just action/reason/member would silently drop the job the second
// time the same member expires or is toggled.
function accessJobKey(action: string, reason: string, memberId: string, now: Date) {
	return `${action}:${reason.toUpperCase()}:${memberId}:${now.getTime()}`;
}

// Deactivates the member and disables their portal login and physical access.
export async function disableMemberAccess(
	tx: Transaction,
	memberId: string,
	reason: DisableAccessReason
) {
	const row = await getMemberAccessProfile(tx, memberId);
	if (!row) return;

	const now = new Date();

	await tx
		.update(members)
		.set({ memberStatus: "inactive", deactivatedAt: now, updatedAt: now })
		.where(eq(members.id, memberId));

	await tx
		.update(users)
		.set({ active: false, deactivatedAt: now, updatedAt: now })
		.where(eq(users.memberId, memberId));

	if (row.profileId) {
		await tx
			.update(biotimePersonProfiles)
			.set({
				desiredAccessEnabled: false,
				accessControlStatus: "pending_sync",
				currentAreaId: row.unauthorizedAreaId,
				lastSyncError: null,
				updatedAt: now,
			})
			.where(
				and(
					eq(biotimePersonProfiles.id, row.profileId),
					eq(biotimePersonProfiles.personType, "member")
				)
			);
	}

	if (row.biotimeEmployeeId && row.profileId) {
		await tx
			.insert(accessControlSyncJobs)
			.values({
				memberId,
				biotimePersonProfileId: row.profileId,
				personType: "member",
				action: "DISABLE_ACCESS",
				status: "pending",
				payload: {
					biotimeEmployeeId: row.biotimeEmployeeId,
					areaIds: [row.unauthorizedAreaId ?? 1],
					reason,
				},
				idempotencyKey: accessJobKey("DISABLE_ACCESS", reason, memberId, now),
			})
			.onConflictDoNothing();
	}
}

// Reactivates the member and restores their portal login and physical access.
// Does not lift a portal ban (users.banned), which is managed separately.
export async function enableMemberAccess(
	tx: Transaction,
	memberId: string,
	reason: EnableAccessReason
) {
	const row = await getMemberAccessProfile(tx, memberId);
	if (!row) return;

	const now = new Date();

	await tx
		.update(members)
		.set({ memberStatus: "active", deactivatedAt: null, updatedAt: now })
		.where(eq(members.id, memberId));

	await tx
		.update(users)
		.set({ active: true, deactivatedAt: null, updatedAt: now })
		.where(eq(users.memberId, memberId));

	if (row.profileId) {
		await tx
			.update(biotimePersonProfiles)
			.set({
				desiredAccessEnabled: true,
				accessControlStatus: "pending_sync",
				currentAreaId: row.authorizedAreaId,
				lastSyncError: null,
				updatedAt: now,
			})
			.where(
				and(
					eq(biotimePersonProfiles.id, row.profileId),
					eq(biotimePersonProfiles.personType, "member")
				)
			);
	}

	if (row.biotimeEmployeeId && row.profileId) {
		await tx
			.insert(accessControlSyncJobs)
			.values({
				memberId,
				biotimePersonProfileId: row.profileId,
				personType: "member",
				action: "ENABLE_ACCESS",
				status: "pending",
				payload: {
					biotimeEmployeeId: row.biotimeEmployeeId,
					areaIds: [row.authorizedAreaId],
					reason,
				},
				idempotencyKey: accessJobKey("ENABLE_ACCESS", reason, memberId, now),
			})
			.onConflictDoNothing();
	}
}

// Shared by the daily membership-expiry cron (expireMembershipsAndDisableAccess) and
// credit-note issuance (issueCreditNoteFn) — both can leave a member with zero
// remaining valid memberships. Disables the member's portal login and physical
// access, but only when no other active membership remains; a no-op otherwise.
export async function disableMemberAccessIfNoValidMembership(
	tx: Transaction,
	memberId: string,
	reason: DisableAccessReason
) {
	const validMembership = await tx.query.memberMemberships.findFirst({
		where: and(eq(memberMemberships.memberId, memberId), eq(memberMemberships.status, "active")),
	});
	if (validMembership) return;

	await disableMemberAccess(tx, memberId, reason);
}

// Called after pending memberships become active. Only members the system had
// switched to "inactive" are reactivated: frozen/terminated members and deleted
// members are left alone, and already-active members still have their access.
export async function enableAccessForActivatedMembers(tx: Transaction, memberIds: string[]) {
	if (memberIds.length === 0) return;

	const inactiveMembers = await tx
		.select({ id: members.id })
		.from(members)
		.where(
			and(
				inArray(members.id, memberIds),
				eq(members.memberStatus, "inactive"),
				isNull(members.deletedAt)
			)
		);

	for (const member of inactiveMembers) {
		await enableMemberAccess(tx, member.id, "membership_activated");
	}
}
