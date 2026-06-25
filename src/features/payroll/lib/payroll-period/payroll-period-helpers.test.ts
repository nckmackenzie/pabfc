import { describe, expect, it } from "vitest";
import {
	getDaysUntilPayrollRemittanceDeadline,
	getPayrollPayDateWindow,
	getPayrollPeriodEnd,
	getPayrollPeriodName,
	getPayrollPeriodRemittanceDeadline,
	getPayrollPeriodStart,
	getPreviousPayrollPeriod,
	isPayrollPayDateAllowed,
	isPayrollPayDateSunday,
	isValidPayrollPeriodParts,
} from "./payroll-period-helpers";

describe("payroll period helpers", () => {
	it("builds month boundaries and labels with date-fns", () => {
		expect(getPayrollPeriodStart(2, 2028)).toBe("2028-02-01");
		expect(getPayrollPeriodEnd(2, 2028)).toBe("2028-02-29");
		expect(getPayrollPeriodName(6, 2026)).toBe("June 2026");
	});

	it("computes remittance deadlines and countdowns", () => {
		expect(getPayrollPeriodRemittanceDeadline(6, 2026)).toBe("2026-07-09");
		expect(
			getDaysUntilPayrollRemittanceDeadline("2026-07-09", new Date("2026-07-05T10:00:00.000Z"))
		).toBe(4);
	});

	it("validates the payroll pay date window", () => {
		expect(getPayrollPayDateWindow(6, 2026)).toEqual({
			start: "2026-06-01",
			end: "2026-07-05",
		});
		expect(isPayrollPayDateAllowed("2026-06-25", 6, 2026)).toBe(true);
		expect(isPayrollPayDateAllowed("2026-07-05", 6, 2026)).toBe(true);
		expect(isPayrollPayDateAllowed("2026-07-06", 6, 2026)).toBe(false);
	});

	it("detects Sundays and previous periods", () => {
		expect(isPayrollPayDateSunday("2026-06-21")).toBe(true);
		expect(isPayrollPayDateSunday("2026-06-22")).toBe(false);
		expect(getPreviousPayrollPeriod(1, 2026)).toEqual({
			periodMonth: 12,
			periodYear: 2025,
		});
	});

	it("checks allowed month and year ranges", () => {
		expect(isValidPayrollPeriodParts(6, 2026)).toBe(true);
		expect(isValidPayrollPeriodParts(13, 2026)).toBe(false);
		expect(isValidPayrollPeriodParts(6, 2110)).toBe(false);
	});
});
