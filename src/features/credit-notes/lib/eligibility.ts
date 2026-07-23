import type Big from "big.js";
import { differenceInCalendarDays, startOfDay } from "date-fns";
import { eq } from "drizzle-orm";
import { creditNotes, memberMemberships, payments } from "@/drizzle/schema";
import type { DbClient } from "@/features/receipts/lib/eligibility";
import { parseCalendarDate } from "@/features/receipts/lib/helpers";
import { toBig, toDecimalString } from "@/lib/helpers";
import { failure, success, type Result } from "@/lib/result";

export type CreditNoteEligibleMembership = typeof memberMemberships.$inferSelect;
export type CreditNoteEligiblePayment = typeof payments.$inferSelect;

export type CreditNoteEligibility = {
	membership: CreditNoteEligibleMembership;
	plan: { id: string; name: string; duration: number; revenueAccountId: number | null };
	member: { id: string; firstName: string; lastName: string };
	payment: CreditNoteEligiblePayment;
	priceCharged: string;
	dailyRate: string;
	unusedDays: number;
	suggestedAmount: string;
	// Ratio of the original payment's tax to its membership-only tax-inclusive total
	// (0 if the payment had no tax) — applied to whatever final amount is credited
	// (suggested or staff-overridden) to split it into creditSubtotal/creditTax. See
	// computeMembershipTaxRatio and computeCreditVatSplit below.
	taxRatio: Big;
};

// Re-run server-side before every issuance — never trust a client-side check alone.
// Mirrors checkVoidEligibility/checkUpgradeEligibility's shape (see
// receipts/lib/{void,upgrade}.ts): fetch the row, confirm its originating payment,
// then apply the credit-note-specific rules.
export async function checkCreditNoteEligibility(
	dbOrTx: DbClient,
	membershipId: string
): Promise<Result<CreditNoteEligibility>> {
	const membership = await dbOrTx.query.memberMemberships.findFirst({
		where: eq(memberMemberships.id, membershipId),
		with: {
			member: { columns: { id: true, firstName: true, lastName: true } },
			membershipPlan: { columns: { id: true, name: true, duration: true, revenueAccountId: true } },
		},
	});
	if (!membership) {
		return failure({ type: "NotFoundError", message: "Membership not found" });
	}

	if (!membership.paymentId) {
		return failure({
			type: "ApplicationError",
			message: "No originating payment found for this membership; cannot issue a credit note.",
		});
	}
	const payment = await dbOrTx.query.payments.findFirst({
		where: eq(payments.id, membership.paymentId),
	});
	if (!payment) {
		return failure({
			type: "ApplicationError",
			message: "The originating payment for this membership could not be found.",
		});
	}
	if (payment.status !== "completed") {
		return failure({
			type: "ApplicationError",
			message: `Only memberships from a completed payment can be credited (payment status: ${payment.status}).`,
		});
	}

	if (membership.status === "terminated") {
		return failure({
			type: "ConflictError",
			message: "This membership has already been terminated.",
		});
	}

	const today = startOfDay(new Date());
	if (!membership.endDate || parseCalendarDate(membership.endDate) <= today) {
		return failure({
			type: "ConflictError",
			message: "This membership has no unused days remaining and cannot be credited.",
		});
	}

	const existingCreditNote = await dbOrTx.query.creditNotes.findFirst({
		where: eq(creditNotes.originalMembershipId, membershipId),
		columns: { id: true },
	});
	if (existingCreditNote) {
		return failure({
			type: "ConflictError",
			message: "A credit note has already been issued for this membership.",
		});
	}

	if (!membership.priceCharged || toBig(membership.priceCharged).lte(0)) {
		return failure({
			type: "ApplicationError",
			message: "This membership has no charge recorded and cannot be credited.",
		});
	}

	const unusedDays = differenceInCalendarDays(
		parseCalendarDate(membership.endDate),
		startOfDay(new Date())
	);

	const priceCharged = membership.priceCharged;
	if (membership.membershipPlan.duration <= 0) {
		return failure({
			type: "ApplicationError",
			message: "Membership plan duration must be greater than zero.",
		});
	}
	const { dailyRate, suggestedAmount } = computeSuggestedCreditAmount({
		priceCharged,
		totalDurationDays: membership.membershipPlan.duration * payment.numberOfPeriods,
		unusedDays,
	});

	const taxRatio = computeMembershipTaxRatio(payment.lineTotal, payment.taxAmount);

	return success({
		membership,
		plan: membership.membershipPlan,
		member: membership.member,
		payment,
		priceCharged,
		dailyRate,
		unusedDays,
		suggestedAmount,
		taxRatio,
	});
}

// payment.totalAmount includes any VAT-exempt addon subtotal paid alongside the
// membership (see finalizeMembershipPayment), so it can't be used as the VAT
// ratio's denominator — that would understate the VAT share of every credit note.
// lineTotal + taxAmount is the membership-only tax-inclusive total (addons
// excluded), which is the correct base for the ratio.
export function computeMembershipTaxRatio(lineTotal: string, taxAmount: string): Big {
	const membershipTaxInclusiveTotal = toBig(lineTotal).plus(taxAmount);
	return membershipTaxInclusiveTotal.eq(0)
		? toBig(0)
		: toBig(taxAmount).div(membershipTaxInclusiveTotal);
}

// dailyRate = priceCharged / totalDurationDays; suggestedAmount = dailyRate ×
// unusedDays, capped at priceCharged (never suggest crediting more than what was
// actually charged). totalDurationDays covers every period purchased by the
// originating payment. Extracted as a pure function so the capping/rounding math
// is unit-testable without a DB connection.
export function computeSuggestedCreditAmount({
	priceCharged,
	totalDurationDays,
	unusedDays,
}: {
	priceCharged: string;
	totalDurationDays: number;
	unusedDays: number;
}) {
	const dailyRateBig = toBig(priceCharged).div(totalDurationDays);
	const rawSuggested = dailyRateBig.times(unusedDays);
	const cappedSuggested = rawSuggested.gt(toBig(priceCharged)) ? toBig(priceCharged) : rawSuggested;

	return {
		dailyRate: toDecimalString(dailyRateBig),
		suggestedAmount: toDecimalString(cappedSuggested),
	};
}

// Splits a credited amount into its revenue (creditSubtotal) and VAT (creditTax)
// portions using the eligibility check's taxRatio — shared so the UI preview (off
// the suggested amount) and the issuance mutation (off the possibly-overridden
// final amount) compute the split identically.
export function computeCreditVatSplit(amount: string, taxRatio: CreditNoteEligibility["taxRatio"]) {
	const creditTax = toDecimalString(toBig(amount).times(taxRatio));
	const creditSubtotal = toDecimalString(toBig(amount).minus(creditTax));
	return { creditSubtotal, creditTax };
}
