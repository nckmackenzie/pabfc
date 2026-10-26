import { and, eq } from "drizzle-orm";
import {
	accessControlSyncJobs,
	biotimePersonProfiles,
	members,
	users,
} from "@/drizzle/schema";
import type { Transaction } from "@/features/receipts/services/membership-payment-finalizer";

type DisableAccessReason = "manual_deactivation" | "no_active_membership";
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

// Runs when the agent reports a member's BioTime person was created. The
// person is created without access, but a membership may have been bought
// while the job was queued, and the agent may not have honoured the payload's
// area. So the profile's desired state is applied explicitly: ENABLE_ACCESS if
// access is now wanted, otherwise DISABLE_ACCESS unless the response confirms
// the person already sits in the unauthorized area.
export async function syncAccessAfterEmployeeCreated(
	tx: Transaction,
	{
		profileId,
		memberId,
		biotimeEmployeeId,
		createdAreaId,
	}: {
		profileId: string;
		memberId: string;
		biotimeEmployeeId: number;
		createdAreaId: number | null;
	}
) {
	const profile = await tx.query.biotimePersonProfiles.findFirst({
		where: eq(biotimePersonProfiles.id, profileId),
		columns: { desiredAccessEnabled: true, authorizedAreaId: true, unauthorizedAreaId: true },
	});
	if (!profile) return;

	const now = new Date();
	const wantsAccess = profile.desiredAccessEnabled;
	if (!wantsAccess && createdAreaId === profile.unauthorizedAreaId) {
		await tx
			.update(biotimePersonProfiles)
			.set({ accessControlStatus: "disabled", updatedAt: now })
			.where(eq(biotimePersonProfiles.id, profileId));
		return;
	}

	const action = wantsAccess ? "ENABLE_ACCESS" : "DISABLE_ACCESS";
	const reason = wantsAccess ? "membership_activated" : "no_active_membership";
	const areaId = wantsAccess ? profile.authorizedAreaId : profile.unauthorizedAreaId;

	await tx
		.update(biotimePersonProfiles)
		.set({ accessControlStatus: "pending_sync", updatedAt: now })
		.where(eq(biotimePersonProfiles.id, profileId));

	await tx
		.insert(accessControlSyncJobs)
		.values({
			memberId,
			biotimePersonProfileId: profileId,
			personType: "member",
			action,
			status: "pending",
			payload: { biotimeEmployeeId, areaIds: [areaId], reason },
			idempotencyKey: accessJobKey(action, reason, memberId, now),
		})
		.onConflictDoNothing();
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
