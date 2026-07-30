import { eq, or } from "drizzle-orm";
import {
	memberMemberships,
	membershipPlans,
	membershipUpgrades,
	payments,
	paymentMembers,
} from "@/drizzle/schema";
import type { DbClient } from "@/features/receipts/lib/eligibility";
import { findLaterMembership } from "@/features/receipts/lib/eligibility";
import {
	computeDaysLate,
	evaluateLateUpgradeEligibility,
	resolveLateUpgradeGraceDays,
} from "@/features/receipts/lib/helpers";
import { dateFormat } from "@/lib/helpers";
import { failure, success, type Result } from "@/lib/result";

export type UpgradeEligiblePayment = typeof payments.$inferSelect;
export type UpgradeEligiblePlan = typeof membershipPlans.$inferSelect;
export type UpgradeEligibleMembership = typeof memberMemberships.$inferSelect;

export type UpgradeEligibility = {
	payment: UpgradeEligiblePayment;
	plan: UpgradeEligiblePlan;
	memberships: UpgradeEligibleMembership[];
	coveredMembers: { id: string; name: string }[];
	billingMemberId: string;
	originalStartDate: string;
	originalNumberOfPeriods: number;
	isLate: boolean;
	daysLate: number | null;
	graceDaysAllowed: number | null;
};

// Re-run server-side before every upgrade — never trust a client-side check alone.
// Mirrors checkVoidEligibility's shape/query pattern (see void.ts): fetch the
// payment, confirm it's still the covered members' latest membership, then apply
// the upgrade-specific rules (single-use, not itself already an upgrade side).
export async function checkUpgradeEligibility(
	dbOrTx: DbClient,
	paymentId: string,
	hasLateUpgradePermission: boolean
): Promise<Result<UpgradeEligibility>> {
	const payment = await dbOrTx.query.payments.findFirst({
		where: eq(payments.id, paymentId),
	});
	if (!payment) {
		return failure({ type: "NotFoundError", message: "Payment not found" });
	}
	if (payment.status !== "completed") {
		return failure({
			type: "ApplicationError",
			message: `Only completed payments can be upgraded (current status: ${payment.status}).`,
		});
	}
	if (!payment.planId) {
		return failure({
			type: "ApplicationError",
			message: "This payment is not linked to a membership plan and cannot be upgraded.",
		});
	}

	const plan = await dbOrTx.query.membershipPlans.findFirst({
		where: eq(membershipPlans.id, payment.planId),
	});
	if (!plan) {
		return failure({ type: "NotFoundError", message: "Original plan not found" });
	}

	const coveredMemberRows = await dbOrTx.query.paymentMembers.findMany({
		where: eq(paymentMembers.paymentId, payment.id),
		with: {
			member: { columns: { id: true, firstName: true, lastName: true } },
		},
	});
	const coveredMembers = coveredMemberRows.map(({ member }) => ({
		id: member.id,
		name: `${member.firstName} ${member.lastName}`,
	}));

	const memberships = await dbOrTx.query.memberMemberships.findMany({
		where: eq(memberMemberships.paymentId, payment.id),
	});
	const membershipRow = memberships[0];
	if (!membershipRow) {
		return failure({
			type: "ApplicationError",
			message: "No membership record found for this payment; cannot verify upgrade eligibility.",
		});
	}

	// A terminated membership (e.g. closed early via a credit note — see
	// credit-note.mutations.api.ts) is never eligible, late-upgrade grace period or
	// not. This is a real state change, not date-derived, so it's checked against
	// the actual column rather than computed like the active/expired boundary below.
	// Checked across every covered row, not just memberships[0]: a credit note
	// terminates one member's row at a time (`.where(eq(memberMemberships.id,
	// membershipId))`), so a multi-member (group/family) payment can have one
	// covered member terminated while the others are still active/expired — the
	// upgrade mutation below updates every row in `memberships`, so leaving any one
	// of them terminated and still eligible would silently un-terminate it.
	if (memberships.some((membership) => membership.status === "terminated")) {
		return failure({
			type: "ApplicationError",
			message: "This membership was terminated and cannot be upgraded.",
		});
	}

	// "Expired" stays a computed check (endDate < today) rather than trusting the
	// stored `status` column, which only flips active→expired once
	// runMembershipMaintenance next runs and can lag the real date. `plan` here is
	// the member's *original* plan — its lateUpgradeGraceDays override (never the
	// new/target plan's) governs the grace period, per task.md.
	const today = dateFormat(new Date());
	let isLate = false;
	let daysLate: number | null = null;
	let graceDaysAllowed: number | null = null;

	if (membershipRow.endDate && membershipRow.endDate < today) {
		const settingsRow = await dbOrTx.query.settings.findFirst({
			columns: { billing: true },
		});
		const resolvedGraceDays = resolveLateUpgradeGraceDays(
			plan,
			settingsRow?.billing?.lateUpgradeGraceDays
		);
		const decision = evaluateLateUpgradeEligibility({
			daysLate: computeDaysLate(membershipRow.endDate, today),
			graceDaysAllowed: resolvedGraceDays,
			hasLateUpgradePermission,
		});
		if (!decision.eligible) {
			return failure({ type: "ApplicationError", message: decision.reason });
		}
		isLate = true;
		daysLate = decision.daysLate;
		graceDaysAllowed = decision.graceDaysAllowed;
	}

	// A member has "renewed" if any other membership row of theirs (not created by
	// this payment) starts later than the membership this payment created — the same
	// rule Void uses to confirm a payment is still the member's latest.
	for (const { id: memberId, name } of coveredMembers) {
		const laterMembership = await findLaterMembership(
			dbOrTx,
			memberId,
			payment.id,
			membershipRow.startDate
		);
		if (laterMembership) {
			return failure({
				type: "ConflictError",
				message: `${name} has already renewed with a later membership (${laterMembership.startDate} to ${laterMembership.endDate ?? "ongoing"}) — this is no longer their latest payment and cannot be upgraded.`,
			});
		}
	}

	const relatedUpgrade = await dbOrTx.query.membershipUpgrades.findFirst({
		where: or(
			eq(membershipUpgrades.originalPaymentId, payment.id),
			eq(membershipUpgrades.upgradePaymentId, payment.id)
		),
	});
	if (relatedUpgrade) {
		const message =
			relatedUpgrade.originalPaymentId === payment.id
				? "This payment has already been upgraded once and cannot be upgraded again."
				: "This payment is itself an upgrade top-up payment and cannot be upgraded again.";
		return failure({ type: "ConflictError", message });
	}

	return success({
		payment,
		plan,
		memberships,
		coveredMembers,
		billingMemberId: payment.memberId,
		originalStartDate: membershipRow.startDate,
		originalNumberOfPeriods: payment.numberOfPeriods,
		isLate,
		daysLate,
		graceDaysAllowed,
	});
}
