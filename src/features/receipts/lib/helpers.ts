import { addDays, parseISO } from "date-fns";
import type { MembershipStatus } from "@/drizzle/schema";

// "yyyy-MM-dd" strings must go through parseISO (interpreted as local midnight),
// not `new Date(str)` (interpreted as UTC midnight) — the latter can shift the
// calendar date by a day once converted to local time in non-UTC timezones.
export function parseCalendarDate(value: Date | string): Date {
	return typeof value === "string" ? parseISO(value) : value;
}

const NON_BLOCKING_STATUSES = ["cancelled", ""] as const;

export function membershipRangeConflicts({
	status,
	existingStart,
	existingEnd,
	newStart,
	newEnd,
}: {
	status: MembershipStatus;
	existingStart: string;
	existingEnd: string | null;
	newStart: string;
	newEnd: string;
}): boolean {
	if (NON_BLOCKING_STATUSES.includes(status as (typeof NON_BLOCKING_STATUSES)[number])) {
		return false;
	}
	const existingEndsAt = existingEnd ?? "9999-12-31";
	return existingStart <= newEnd && existingEndsAt >= newStart;
}

export function computeMembershipEndDate(
	startDate: Date | string,
	planDurationDays: number,
	numberOfPeriods: number
): Date {
	return addDays(parseCalendarDate(startDate), planDurationDays * numberOfPeriods);
}

// Staff-entered default for the upgrade form's top-up field — the price difference
// between what the new plan would cost for the same number of periods/members and
// what was already paid. Purely a pre-fill hint: whatever the staff member submits
// is what's actually charged (see membership-upgrades in task.md).
export function computeSuggestedTopUpAmount({
	newPlanPrice,
	newPlanMemberCount,
	originalNumberOfPeriods,
	originalPaymentAmount,
}: {
	newPlanPrice: number;
	newPlanMemberCount: number;
	originalNumberOfPeriods: number;
	originalPaymentAmount: number;
}): number {
	const newPlanTotal = newPlanPrice * newPlanMemberCount * originalNumberOfPeriods;
	return Math.max(0, newPlanTotal - originalPaymentAmount);
}

// A plan is only offered as an upgrade target when it isn't the member's current
// plan, its duration is at least as long (e.g. a Monthly/30-day plan can't
// "upgrade" to a Fortnight/14-day plan, since that would shorten the membership),
// and it requires the same number of members — the upgrade flow can't add or
// remove covered members, so a plan needing a different headcount would leave the
// membership rows mismatched against the plan's own memberCount invariant (the
// same one createManualMembershipPaymentFn enforces at payment creation time).
export function isEligibleUpgradePlan(
	candidatePlan: { id: string; duration: number; memberCount: number },
	currentPlan: { id: string; duration: number; memberCount: number }
): boolean {
	if (candidatePlan.id === currentPlan.id) return false;
	if (candidatePlan.memberCount !== currentPlan.memberCount) return false;
	return candidatePlan.duration >= currentPlan.duration;
}

// Splits a decimal money amount (e.g. "100.00") into `count` shares that sum back
// to the original amount exactly, in cents, rather than the naive `amount / count`
// which loses or gains cents to floating-point/toFixed rounding (e.g. 100/3 = 33.33
// x3 = 99.99). Any leftover cent(s) from the integer division go to the first share
// so the caller can assign them to a designated member (e.g. the billing member).
export function splitAmountEvenly(amount: string, count: number): string[] {
	const totalCents = Math.round(parseFloat(amount) * 100);
	const baseShareCents = Math.floor(totalCents / count);
	const remainderCents = totalCents - baseShareCents * count;

	return Array.from({ length: count }, (_, index) => {
		const shareCents = baseShareCents + (index < remainderCents ? 1 : 0);
		return (shareCents / 100).toFixed(2);
	});
}
