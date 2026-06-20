import { describe, expect, it } from "vitest";
import {
	applyProration,
	computeEmployeeProratedDays,
	computeWorkingDaysInMonth,
} from "./proration";

describe("proration utilities", () => {
	it("counts working days for a full month with no holidays", () => {
		expect(computeWorkingDaysInMonth(2026, 6, [])).toBe(22);
	});

	it("does not prorate a full-month employee", () => {
		const result = computeEmployeeProratedDays(
			"2020-01-01",
			null,
			"2026-06-01",
			"2026-06-30",
			[]
		);

		expect(result.isProrated).toBe(false);
		expect(result.proratedDays).toBe(22);
		expect(result.totalWorkingDays).toBe(22);
		expect(result.proratedReason).toBeNull();
		expect(result.proratedFactor).toBe(1);
	});

	it("prorates a mid-month new hire", () => {
		const result = computeEmployeeProratedDays(
			"2026-06-10",
			null,
			"2026-06-01",
			"2026-06-30",
			[]
		);

		expect(result.isProrated).toBe(true);
		expect(result.proratedDays).toBe(15);
		expect(result.totalWorkingDays).toBe(22);
		expect(result.proratedReason).toBe("new_hire");
		expect(result.proratedFactor).toBeCloseTo(15 / 22, 6);
	});

	it("prorates a mid-month termination", () => {
		const result = computeEmployeeProratedDays(
			"2020-01-01",
			"2026-06-20",
			"2026-06-01",
			"2026-06-30",
			[]
		);

		expect(result.isProrated).toBe(true);
		expect(result.proratedDays).toBe(15);
		expect(result.totalWorkingDays).toBe(22);
		expect(result.proratedReason).toBe("termination");
	});

	it("handles hire and termination in the same month", () => {
		const result = computeEmployeeProratedDays(
			"2026-06-10",
			"2026-06-20",
			"2026-06-01",
			"2026-06-30",
			[]
		);

		expect(result.isProrated).toBe(true);
		expect(result.proratedDays).toBe(8);
		expect(result.proratedReason).toBe("new_hire");
	});

	it("returns zero days when the employee starts after the period", () => {
		const result = computeEmployeeProratedDays(
			"2026-07-01",
			null,
			"2026-06-01",
			"2026-06-30",
			[]
		);

		expect(result.isProrated).toBe(true);
		expect(result.proratedDays).toBe(0);
		expect(result.proratedFactor).toBe(0);
	});

	it("excludes public holidays from the denominator", () => {
		expect(computeWorkingDaysInMonth(2026, 1, ["2026-01-01"])).toBe(21);
	});

	it("handles leap-year february", () => {
		expect(computeWorkingDaysInMonth(2024, 2, [])).toBe(21);
	});

	it("applies rounded proration to an earnings figure", () => {
		expect(applyProration(100000, 15 / 22)).toBe(68181.82);
	});
});
