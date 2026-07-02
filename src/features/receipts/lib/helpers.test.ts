import { describe, expect, it } from "vitest";
import { computeMembershipEndDate, membershipRangeConflicts } from "./helpers";

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
		expect(endDate.toISOString().slice(0, 10)).toBe("2026-01-31");
	});

	it("multiplies duration by numberOfPeriods for a daily plan", () => {
		const endDate = computeMembershipEndDate("2026-01-01", 1, 3);
		expect(endDate.toISOString().slice(0, 10)).toBe("2026-01-04");
	});

	it("multiplies duration by numberOfPeriods for a monthly-ish plan", () => {
		const endDate = computeMembershipEndDate("2026-01-01", 30, 2);
		expect(endDate.toISOString().slice(0, 10)).toBe("2026-03-02");
	});

	it("accepts a Date object and a yyyy-MM-dd string and produces the same result", () => {
		const fromString = computeMembershipEndDate("2026-01-01", 30, 1);
		const fromDate = computeMembershipEndDate(new Date("2026-01-01"), 30, 1);
		expect(fromString.getTime()).toBe(fromDate.getTime());
	});
});
