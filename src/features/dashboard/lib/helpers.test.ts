import { format } from "date-fns";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getFinanceStatDates } from "./helpers";

describe("getFinanceStatDates", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("returns month-to-date ranges for a mid-month date", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-07-14T09:30:00.000Z"));

		const dates = getFinanceStatDates();

		expect(format(dates.currentPeriodStart, "yyyy-MM-dd")).toBe("2026-07-01");
		expect(format(dates.currentPeriodEnd, "yyyy-MM-dd")).toBe("2026-07-14");
		expect(format(dates.previousPeriodStart, "yyyy-MM-dd")).toBe("2026-06-01");
		expect(format(dates.previousPeriodEnd, "yyyy-MM-dd")).toBe("2026-06-14");
	});

	it("caps the previous-period end to the last day of a shorter month", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-03-31T09:30:00.000Z"));

		const dates = getFinanceStatDates();

		expect(format(dates.currentPeriodStart, "yyyy-MM-dd")).toBe("2026-03-01");
		expect(format(dates.currentPeriodEnd, "yyyy-MM-dd")).toBe("2026-03-31");
		expect(format(dates.previousPeriodStart, "yyyy-MM-dd")).toBe("2026-02-01");
		expect(format(dates.previousPeriodEnd, "yyyy-MM-dd")).toBe("2026-02-28");
	});

	it("handles year boundaries when comparing January against December", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-01-14T09:30:00.000Z"));

		const dates = getFinanceStatDates();

		expect(format(dates.currentPeriodStart, "yyyy-MM-dd")).toBe("2026-01-01");
		expect(format(dates.currentPeriodEnd, "yyyy-MM-dd")).toBe("2026-01-14");
		expect(format(dates.previousPeriodStart, "yyyy-MM-dd")).toBe("2025-12-01");
		expect(format(dates.previousPeriodEnd, "yyyy-MM-dd")).toBe("2025-12-14");
	});
});
