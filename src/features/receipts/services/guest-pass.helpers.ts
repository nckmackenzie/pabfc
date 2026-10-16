import { and, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import {
	memberMemberships,
	members,
	membershipPlans,
	paymentMembers,
	payments,
} from "@/drizzle/schema";
import {
	type IdentityField,
	type IdentityMatch,
	kenyanPhoneVariants,
	type MatchedMemberHistory,
	type SponsorEligibilityInput,
} from "@/features/receipts/lib/guest-pass";
import type { Transaction } from "@/features/receipts/services/membership-payment-finalizer";

// Looks up members by phone (any equivalent form) or national ID, deliberately
// WITHOUT a deletedAt filter: a soft-deleted member still owns their unique
// contact / id_number, so they must still block a new registration.
export async function findMembersByIdentity({
	tx,
	contact,
	idNumber,
}: {
	tx: Transaction;
	contact?: string | null;
	idNumber?: string | null;
}): Promise<IdentityMatch[]> {
	const variants = contact ? kenyanPhoneVariants(contact) : [];
	const normalizedId = idNumber?.trim().toLowerCase() ?? "";

	const conditions = [];
	if (variants.length > 0) conditions.push(inArray(members.contact, variants));
	if (normalizedId) {
		conditions.push(sql`lower(trim(${members.idNumber})) = ${normalizedId}`);
	}
	if (conditions.length === 0) return [];

	const rows = await tx
		.select({
			id: members.id,
			memberNo: members.memberNo,
			firstName: members.firstName,
			lastName: members.lastName,
			contact: members.contact,
			idNumber: members.idNumber,
			deletedAt: members.deletedAt,
		})
		.from(members)
		.where(or(...conditions));

	return rows.map((row) => {
		const matchedFields: IdentityField[] = [];
		if (variants.includes(row.contact)) matchedFields.push("phone");
		if (normalizedId && row.idNumber?.trim().toLowerCase() === normalizedId) {
			matchedFields.push("idNumber");
		}
		return {
			id: row.id,
			memberNo: row.memberNo,
			fullName: `${row.firstName} ${row.lastName}`,
			matchedFields,
			deletedAt: row.deletedAt,
		};
	});
}

// Memberships and every payment (as billing member or covered member) for the
// matched members — the input planFriendEligibility needs to decide on reuse.
export async function loadMatchedMemberHistory(
	tx: Transaction,
	memberIds: string[]
): Promise<MatchedMemberHistory[]> {
	if (memberIds.length === 0) return [];

	const [membershipRows, billedRows, coveredRows] = await Promise.all([
		tx
			.select({ memberId: memberMemberships.memberId })
			.from(memberMemberships)
			.where(inArray(memberMemberships.memberId, memberIds)),
		tx
			.select({
				memberId: payments.memberId,
				id: payments.id,
				status: payments.status,
				sponsorMemberId: payments.sponsorMemberId,
			})
			.from(payments)
			.where(inArray(payments.memberId, memberIds)),
		tx
			.select({
				memberId: paymentMembers.memberId,
				id: payments.id,
				status: payments.status,
				sponsorMemberId: payments.sponsorMemberId,
			})
			.from(paymentMembers)
			.innerJoin(payments, eq(payments.id, paymentMembers.paymentId))
			.where(inArray(paymentMembers.memberId, memberIds)),
	]);

	return memberIds.map((memberId) => {
		const paymentsById = new Map<string, { status: string; sponsorMemberId: string | null }>();
		for (const row of [...billedRows, ...coveredRows]) {
			if (row.memberId === memberId) {
				paymentsById.set(row.id, { status: row.status, sponsorMemberId: row.sponsorMemberId });
			}
		}
		return {
			memberId,
			membershipCount: membershipRows.filter((row) => row.memberId === memberId).length,
			payments: [...paymentsById.values()],
		};
	});
}

export async function loadSponsorEligibilityInput(
	tx: Transaction,
	sponsorMemberId: string,
	today: string
): Promise<SponsorEligibilityInput> {
	const member = await tx.query.members.findFirst({
		where: eq(members.id, sponsorMemberId),
		columns: { memberStatus: true, deletedAt: true },
	});

	const memberships = await tx
		.select({
			status: memberMemberships.status,
			startDate: memberMemberships.startDate,
			endDate: memberMemberships.endDate,
			isGuestPass: membershipPlans.isGuestPass,
		})
		.from(memberMemberships)
		.innerJoin(membershipPlans, eq(membershipPlans.id, memberMemberships.membershipPlanId))
		.where(
			and(
				eq(memberMemberships.memberId, sponsorMemberId),
				eq(memberMemberships.status, "active"),
				lte(memberMemberships.startDate, today),
				or(isNull(memberMemberships.endDate), sql`${memberMemberships.endDate} >= ${today}`)
			)
		);

	return { member: member ?? null, memberships, today };
}
