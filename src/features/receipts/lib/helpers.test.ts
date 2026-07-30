import { format, parseISO } from "date-fns";
import { describe, expect, it } from "vitest";
import {
	computeMembershipEndDate,
	computeSuggestedTopUpAmount,
	computeDaysLate,
	evaluateLateUpgradeEligibility,
	isEligibleUpgradePlan,
	membershipRangeConflicts,
	resolveLateUpgradeGraceDays,
	splitAmountEvenly,
} from "./helpers";

describe("membershipRangeConflicts", () => {
	it("conflicts when date ranges are identical on an active membership", () => {
		expect(
			membershipRangeConflicts({
				status: "active",
				existingStart: "2026-01-01",
				existingEnd: "2026-01-31",
				newStart: "2026-01-01",
				newEnd: "2026-01-31",
			})
		).toBe(true);
	});

	it("conflicts when the new range is fully inside an expired membership's range", () => {
		expect(
			membershipRangeConflicts({
				status: "expired",
				existingStart: "2026-01-01",
				existingEnd: "2026-03-31",
				newStart: "2026-02-01",
				newEnd: "2026-02-15",
			})
		).toBe(true);
	});

	it("does not conflict when the new range starts the day after the existing one ends", () => {
		expect(
			membershipRangeConflicts({
				status: "active",
				existingStart: "2026-01-01",
				existingEnd: "2026-01-31",
				newStart: "2026-02-01",
				newEnd: "2026-02-28",
			})
		).toBe(false);
	});

	it("does not conflict with a cancelled membership", () => {
		expect(
			membershipRangeConflicts({
				status: "cancelled",
				existingStart: "2026-01-01",
				existingEnd: "2026-01-31",
				newStart: "2026-01-10",
				newEnd: "2026-01-20",
			})
		).toBe(false);
	});

	it("does not conflict with a legacy empty-string status", () => {
		expect(
			membershipRangeConflicts({
				status: "",
				existingStart: "2026-01-01",
				existingEnd: "2026-01-31",
				newStart: "2026-01-10",
				newEnd: "2026-01-20",
			})
		).toBe(false);
	});

	it("conflicts with an open-ended (null endDate) membership that starts before the new range", () => {
		expect(
			membershipRangeConflicts({
				status: "active",
				existingStart: "2026-01-01",
				existingEnd: null,
				newStart: "2026-06-01",
				newEnd: "2026-06-30",
			})
		).toBe(true);
	});

	it("conflicts on a partial overlap where the new range starts before and ends inside the existing range", () => {
		expect(
			membershipRangeConflicts({
				status: "active",
				existingStart: "2026-02-01",
				existingEnd: "2026-02-28",
				newStart: "2026-01-15",
				newEnd: "2026-02-10",
			})
		).toBe(true);
	});

	it("conflicts on a partial overlap where the new range starts inside and ends after the existing range", () => {
		expect(
			membershipRangeConflicts({
				status: "active",
				existingStart: "2026-02-01",
				existingEnd: "2026-02-28",
				newStart: "2026-02-20",
				newEnd: "2026-03-10",
			})
		).toBe(true);
	});

	it("does not conflict when the new range is entirely before the existing range", () => {
		expect(
			membershipRangeConflicts({
				status: "active",
				existingStart: "2026-03-01",
				existingEnd: "2026-03-31",
				newStart: "2026-01-01",
				newEnd: "2026-01-31",
			})
		).toBe(false);
	});

	it("does not conflict when the new range is entirely after the existing range", () => {
		expect(
			membershipRangeConflicts({
				status: "active",
				existingStart: "2026-01-01",
				existingEnd: "2026-01-31",
				newStart: "2026-03-01",
				newEnd: "2026-03-31",
			})
		).toBe(false);
	});
});

describe("computeMembershipEndDate", () => {
	it("reproduces the original single-period behavior (startDate + duration)", () => {
		const endDate = computeMembershipEndDate("2026-01-01", 30, 1);
		expect(format(endDate, "yyyy-MM-dd")).toBe("2026-01-31");
	});

	it("multiplies duration by numberOfPeriods for a daily plan", () => {
		const endDate = computeMembershipEndDate("2026-01-01", 1, 3);
		expect(format(endDate, "yyyy-MM-dd")).toBe("2026-01-04");
	});

	it("multiplies duration by numberOfPeriods for a monthly-ish plan", () => {
		const endDate = computeMembershipEndDate("2026-01-01", 30, 2);
		expect(format(endDate, "yyyy-MM-dd")).toBe("2026-03-02");
	});

	it("treats a yyyy-MM-dd string as the local calendar date, not UTC midnight", () => {
		// Guards against the `new Date("yyyy-MM-dd")` timezone-shift bug: that constructor
		// parses as UTC midnight, which can land on the previous calendar day once read
		// back in a positive-UTC-offset timezone. parseISO (used internally) must not do this.
		const endDate = computeMembershipEndDate("2026-01-01", 0, 1);
		expect(format(endDate, "yyyy-MM-dd")).toBe("2026-01-01");
	});

	it("accepts a Date object and a yyyy-MM-dd string and produces the same result", () => {
		const fromString = computeMembershipEndDate("2026-01-01", 30, 1);
		const fromDate = computeMembershipEndDate(parseISO("2026-01-01"), 30, 1);
		expect(fromString.getTime()).toBe(fromDate.getTime());
	});
});

describe("splitAmountEvenly", () => {
	it("returns the full amount for a single share", () => {
		expect(splitAmountEvenly("100.00", 1)).toEqual(["100.00"]);
	});

	it("splits an evenly-divisible amount with no remainder", () => {
		expect(splitAmountEvenly("100.00", 2)).toEqual(["50.00", "50.00"]);
	});

	it("gives leftover cents to the leading shares so the total matches exactly", () => {
		const shares = splitAmountEvenly("100.00", 3);
		expect(shares).toEqual(["33.34", "33.33", "33.33"]);
		const sum = shares.reduce((total, share) => total + parseFloat(share), 0);
		expect(sum).toBeCloseTo(100, 2);
	});

	it("puts the single leftover cent on the first share only", () => {
		expect(splitAmountEvenly("10.01", 2)).toEqual(["5.01", "5.00"]);
	});

	it("handles a large member count without losing cents", () => {
		const shares = splitAmountEvenly("1000.00", 7);
		const totalCents = shares.reduce((total, share) => total + Math.round(parseFloat(share) * 100), 0);
		expect(totalCents).toBe(100000);
	});
});

describe("computeSuggestedTopUpAmount", () => {
	it("reproduces the Fortnight → Monthly example from the spec (Ksh 3,000 → Ksh 5,000, suggests Ksh 2,000)", () => {
		expect(
			computeSuggestedTopUpAmount({
				newPlanPrice: 5000,
				newPlanMemberCount: 1,
				originalNumberOfPeriods: 1,
				originalPaymentAmount: 3000,
			})
		).toBe(2000);
	});

	it("multiplies by member count and number of periods for group/multi-period plans", () => {
		expect(
			computeSuggestedTopUpAmount({
				newPlanPrice: 1000,
				newPlanMemberCount: 3,
				originalNumberOfPeriods: 2,
				originalPaymentAmount: 4000,
			})
		).toBe(2000); // (1000 * 3 * 2) - 4000
	});

	it("floors at zero rather than going negative when the original payment already covers the new plan", () => {
		expect(
			computeSuggestedTopUpAmount({
				newPlanPrice: 1000,
				newPlanMemberCount: 1,
				originalNumberOfPeriods: 1,
				originalPaymentAmount: 5000,
			})
		).toBe(0);
	});
});

describe("isEligibleUpgradePlan", () => {
	const monthly = { id: "monthly", duration: 30, memberCount: 1 };
	const fortnight = { id: "fortnight", duration: 14, memberCount: 1 };

	it("rejects a shorter-duration plan (Monthly cannot 'upgrade' to Fortnight)", () => {
		expect(isEligibleUpgradePlan(fortnight, monthly)).toBe(false);
	});

	it("allows a longer-duration plan (Fortnight can upgrade to Monthly)", () => {
		expect(isEligibleUpgradePlan(monthly, fortnight)).toBe(true);
	});

	it("allows an equal-duration plan that isn't the current one", () => {
		const monthlyPremium = { id: "monthly-premium", duration: 30, memberCount: 1 };
		expect(isEligibleUpgradePlan(monthlyPremium, monthly)).toBe(true);
	});

	it("rejects the current plan itself even though duration matches", () => {
		expect(isEligibleUpgradePlan(monthly, monthly)).toBe(false);
	});

	it("rejects a plan with a different member count, even with a longer duration", () => {
		const familyMonthly = { id: "family-monthly", duration: 30, memberCount: 3 };
		expect(isEligibleUpgradePlan(familyMonthly, monthly)).toBe(false);
	});

	it("allows a plan with a matching member count greater than 1", () => {
		const familyMonthly = { id: "family-monthly", duration: 30, memberCount: 3 };
		const familyFortnight = { id: "family-fortnight", duration: 14, memberCount: 3 };
		expect(isEligibleUpgradePlan(familyMonthly, familyFortnight)).toBe(true);
	});
});

describe("resolveLateUpgradeGraceDays", () => {
	it("uses the plan-level override when set", () => {
		expect(resolveLateUpgradeGraceDays({ lateUpgradeGraceDays: 7 }, 3)).toBe(7);
	});

	it("falls back to the global default when the plan has no override", () => {
		expect(resolveLateUpgradeGraceDays({ lateUpgradeGraceDays: null }, 5)).toBe(5);
	});

	it("falls back to 3 when neither the plan override nor the global default is set", () => {
		expect(resolveLateUpgradeGraceDays({ lateUpgradeGraceDays: null }, undefined)).toBe(3);
		expect(resolveLateUpgradeGraceDays({ lateUpgradeGraceDays: null }, null)).toBe(3);
	});

	it("treats a plan override of 0 as a real value, not a missing one", () => {
		expect(resolveLateUpgradeGraceDays({ lateUpgradeGraceDays: 0 }, 5)).toBe(0);
	});
});

describe("computeDaysLate", () => {
	it("returns the number of calendar days between endDate and today", () => {
		expect(computeDaysLate("2026-07-01", "2026-07-05")).toBe(4);
	});

	it("returns 0 when endDate is today", () => {
		expect(computeDaysLate("2026-07-05", "2026-07-05")).toBe(0);
	});

	it("returns a large value for a long-expired membership", () => {
		expect(computeDaysLate("2026-01-01", "2026-07-05")).toBe(185);
	});
});

describe("evaluateLateUpgradeEligibility", () => {
	it("is ineligible when daysLate exceeds graceDaysAllowed, regardless of permission", () => {
		const result = evaluateLateUpgradeEligibility({
			daysLate: 5,
			graceDaysAllowed: 3,
			hasLateUpgradePermission: true,
		});
		expect(result.eligible).toBe(false);
	});

	it("is ineligible within the grace period when the user lacks the late-upgrade permission", () => {
		const result = evaluateLateUpgradeEligibility({
			daysLate: 2,
			graceDaysAllowed: 3,
			hasLateUpgradePermission: false,
		});
		expect(result.eligible).toBe(false);
	});

	it("is eligible within the grace period when the user holds the late-upgrade permission", () => {
		const result = evaluateLateUpgradeEligibility({
			daysLate: 2,
			graceDaysAllowed: 3,
			hasLateUpgradePermission: true,
		});
		expect(result).toEqual({ eligible: true, daysLate: 2, graceDaysAllowed: 3 });
	});

	it("is eligible exactly on the last day of the grace period", () => {
		const result = evaluateLateUpgradeEligibility({
			daysLate: 3,
			graceDaysAllowed: 3,
			hasLateUpgradePermission: true,
		});
		expect(result.eligible).toBe(true);
	});

	it("is ineligible the day after the grace period ends", () => {
		const result = evaluateLateUpgradeEligibility({
			daysLate: 4,
			graceDaysAllowed: 3,
			hasLateUpgradePermission: true,
		});
		expect(result.eligible).toBe(false);
	});
});
