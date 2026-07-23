import { and, eq } from "drizzle-orm";
import {
	accessControlSyncJobs,
	biotimePersonProfiles,
	memberMemberships,
	members,
	users,
} from "@/drizzle/schema";
import type { Transaction } from "@/features/receipts/services/membership-payment-finalizer";

type DisableAccessReason = "membership_expired" | "credit_note_termination";

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

	const [row] = await tx
		.select({
			memberNo: members.memberNo,
			profileId: biotimePersonProfiles.id,
			biotimeEmployeeId: biotimePersonProfiles.biotimeEmployeeId,
			unauthorizedAreaId: biotimePersonProfiles.unauthorizedAreaId,
		})
		.from(members)
		.leftJoin(biotimePersonProfiles, eq(members.id, biotimePersonProfiles.memberId))
		.where(eq(members.id, memberId))
		.limit(1);
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
				idempotencyKey: `DISABLE_ACCESS:${reason.toUpperCase()}:${memberId}`,
			})
			.onConflictDoNothing();
	}
}
