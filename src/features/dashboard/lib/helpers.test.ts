import { format } from "date-fns";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	getAttendancePeriodBounds,
	getExpiredMembershipStatDates,
	getExpiringMembershipStatDates,
	getFinanceStatDates,
	getMembershipExpiryStatus,
} from "./helpers";

describe("getAttendancePeriodBounds", () => {
	it("computes a 7-day current window ending on the Nairobi day of `now`", () => {
		const bounds = getAttendancePeriodBounds(new Date("2026-03-15T12:00:00Z"));
		expect(bounds.currentEnd).toBe("2026-03-15");
		expect(bounds.currentStart).toBe("2026-03-09");
	});

	it("computes the previous 7-day window immediately before the current one, with no gap or overlap", () => {
		const bounds = getAttendancePeriodBounds(new Date("2026-03-15T12:00:00Z"));
		expect(bounds.previousEnd).toBe("2026-03-08");
		expect(bounds.previousStart).toBe("2026-03-02");
	});

	it("rolls the Nairobi day over exactly at the 21:00 UTC boundary", () => {
		const justBefore = getAttendancePeriodBounds(new Date("2026-03-15T20:59:59Z"));
		const atBoundary = getAttendancePeriodBounds(new Date("2026-03-15T21:00:00Z"));
		expect(justBefore.currentEnd).toBe("2026-03-15");
		expect(atBoundary.currentEnd).toBe("2026-03-16");
	});
});

describe("getExpiredMembershipStatDates", () => {
	it("returns a rolling 30-day window ending on the supplied date", () => {
		const today = new Date("2026-07-22T09:30:00.000Z");

		const dates = getExpiredMembershipStatDates(today);

		expect(format(dates.periodStart, "yyyy-MM-dd")).toBe("2026-06-22");
		expect(format(dates.periodEnd, "yyyy-MM-dd")).toBe("2026-07-22");
	});
});

describe("getExpiringMembershipStatDates", () => {
	it("returns a 7-day window centered on the supplied date", () => {
		const today = new Date("2026-07-22T09:30:00.000Z");

		const dates = getExpiringMembershipStatDates(today);

		expect(format(dates.periodStart, "yyyy-MM-dd")).toBe("2026-07-15");
		expect(format(dates.periodEnd, "yyyy-MM-dd")).toBe("2026-07-29");
	});
});

describe("getFinanceStatDates", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("returns month-to-date ranges for a mid-month date", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-07-14T09:30:00.000Z"));

		const dates = getFinanceStatDates();

		expect(dates.currentPeriodStart.toISOString()).toBe("2026-06-30T21:00:00.000Z");
		expect(dates.currentPeriodEnd).toEqual(new Date("2026-07-14T09:30:00.000Z"));
		expect(dates.previousPeriodStart.toISOString()).toBe("2026-05-31T21:00:00.000Z");
		expect(dates.previousPeriodEnd.toISOString()).toBe("2026-06-14T09:30:00.000Z");
	});

	it("caps the previous-period end to the last day of a shorter month", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-03-31T09:30:00.000Z"));

		const dates = getFinanceStatDates();

		expect(dates.currentPeriodStart.toISOString()).toBe("2026-02-28T21:00:00.000Z");
		expect(dates.currentPeriodEnd).toEqual(new Date("2026-03-31T09:30:00.000Z"));
		expect(dates.previousPeriodStart.toISOString()).toBe("2026-01-31T21:00:00.000Z");
		expect(dates.previousPeriodEnd.toISOString()).toBe("2026-02-28T09:30:00.000Z");
	});

	it("handles year boundaries when comparing January against December", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-01-14T09:30:00.000Z"));

		const dates = getFinanceStatDates();

		expect(dates.currentPeriodStart.toISOString()).toBe("2025-12-31T21:00:00.000Z");
		expect(dates.currentPeriodEnd).toEqual(new Date("2026-01-14T09:30:00.000Z"));
		expect(dates.previousPeriodStart.toISOString()).toBe("2025-11-30T21:00:00.000Z");
		expect(dates.previousPeriodEnd.toISOString()).toBe("2025-12-14T09:30:00.000Z");
	});

	it("preserves the current timestamp on the previous comparison day", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-07-14T09:30:45.123Z"));

		const dates = getFinanceStatDates();

		expect(dates.previousPeriodEnd.toISOString()).toBe("2026-06-14T09:30:45.123Z");
	});
});

describe("getMembershipExpiryStatus", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("returns null when there is no end date", () => {
		expect(getMembershipExpiryStatus(null)).toBeNull();
	});

	it("labels a future end date as not yet expired", () => {
		vi.useFakeTimers();
		// Local midnight 2026-07-20 in the app's Africa/Nairobi (UTC+3) timezone.
		vi.setSystemTime(new Date("2026-07-19T21:00:00.000Z"));

		const status = getMembershipExpiryStatus("2026-07-25");

		expect(status).toEqual({ isExpired: false, label: "Expiring in 5 days" });
	});

	it("labels a past end date as expired", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-07-19T21:00:00.000Z"));

		const status = getMembershipExpiryStatus("2026-07-15");

		expect(status).toEqual({ isExpired: true, label: "Expired 5 days ago" });
	});

	it("treats an end date of today as not yet expired", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-07-19T21:00:00.000Z"));

		const status = getMembershipExpiryStatus("2026-07-20");

		expect(status?.isExpired).toBe(false);
	});
});
