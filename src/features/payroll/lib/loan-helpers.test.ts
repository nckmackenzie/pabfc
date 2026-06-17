import { describe, expect, it } from "vitest";
import { computeLoanSchedule, computeSingleInstalment } from "./loan-helpers";

describe("loan helpers", () => {
	it("computes an interest-free schedule and absorbs rounding on the last instalment", () => {
		const result = computeLoanSchedule(1000, 0, 3);

		expect(result.monthlyInstalment).toBe(333.33);
		expect(result.totalRepayable).toBe(1000);
		expect(result.totalInterest).toBe(0);
		expect(result.schedule).toEqual([
			{
				instalmentNumber: 1,
				principalComponent: 333.33,
				interestComponent: 0,
				totalPayment: 333.33,
				balanceAfter: 666.67,
			},
			{
				instalmentNumber: 2,
				principalComponent: 333.33,
				interestComponent: 0,
				totalPayment: 333.33,
				balanceAfter: 333.34,
			},
			{
				instalmentNumber: 3,
				principalComponent: 333.34,
				interestComponent: 0,
				totalPayment: 333.34,
				balanceAfter: 0,
			},
		]);
	});

	it("computes a reducing-balance schedule with interest", () => {
		const result = computeLoanSchedule(120000, 0.12, 12);

		expect(result.monthlyInstalment).toBe(10661.85);
		expect(result.totalInterest).toBeGreaterThan(0);
		expect(result.schedule[0]).toEqual({
			instalmentNumber: 1,
			principalComponent: 9461.85,
			interestComponent: 1200,
			totalPayment: 10661.85,
			balanceAfter: 110538.15,
		});
		expect(result.schedule.at(-1)).toEqual({
			instalmentNumber: 12,
			principalComponent: 10556.35,
			interestComponent: 105.56,
			totalPayment: 10661.91,
			balanceAfter: 0,
		});
		expect(result.totalRepayable).toBe(127942.26);
	});

	it("computes a normal payroll instalment using the stored scheduled repayment amount", () => {
		const result = computeSingleInstalment(110538.15, 0.12, 10661.85);

		expect(result).toEqual({
			principalComponent: 9556.47,
			interestComponent: 1105.38,
			totalPayment: 10661.85,
			balanceAfter: 100981.68,
		});
	});

	it("defaults an omitted scheduled payment to full settlement", () => {
		const result = computeSingleInstalment(1000, 0.12);

		expect(result).toEqual({
			principalComponent: 1000,
			interestComponent: 10,
			totalPayment: 1010,
			balanceAfter: 0,
		});
	});

	it("caps an interest-free single instalment at the outstanding balance", () => {
		const result = computeSingleInstalment(200, 0, 300);

		expect(result).toEqual({
			principalComponent: 200,
			interestComponent: 0,
			totalPayment: 200,
			balanceAfter: 0,
		});
	});
});
