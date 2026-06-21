import { describe, expect, it } from "vitest";
import {
	computeSalaryAdvanceMonthlyRecoveryAmount,
	computeSalaryAdvanceRecoveryStep,
} from "./salary-advance-helpers";

describe("salary advance helpers", () => {
	it("rounds monthly recovery amounts to two decimals", () => {
		expect(computeSalaryAdvanceMonthlyRecoveryAmount(10000, 3)).toBe(3333.33);
	});

	it("uses the rounded monthly recovery for non-final recoveries", () => {
		expect(
			computeSalaryAdvanceRecoveryStep({
				approvedRecoveryMonths: 3,
				monthlyRecoveryAmount: 3333.33,
				outstandingBalance: 10000,
				recoveriesProcessed: 0,
			})
		).toEqual({
			balanceAfter: 6666.67,
			isLastRecovery: false,
			recoveryAmount: 3333.33,
		});
	});

	it("clears the remaining balance on the final recovery", () => {
		expect(
			computeSalaryAdvanceRecoveryStep({
				approvedRecoveryMonths: 3,
				monthlyRecoveryAmount: 3333.33,
				outstandingBalance: 3333.34,
				recoveriesProcessed: 2,
			})
		).toEqual({
			balanceAfter: 0,
			isLastRecovery: true,
			recoveryAmount: 3333.34,
		});
	});
});
