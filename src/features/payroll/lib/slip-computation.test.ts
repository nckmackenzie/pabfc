import { describe, expect, it } from "vitest";
import { resolveStatutoryRatesSync } from "@/features/payroll/lib/payroll-rate-resolver";
import { computeEmployeeSlip, type SlipComputationInput } from "./slip-computation";

const rates = resolveStatutoryRatesSync(new Date("2026-06-30T00:00:00.000Z"));

function createInput(overrides: Partial<SlipComputationInput> = {}): SlipComputationInput {
	return {
		employee: {
			id: "employee_1",
			hasHelbLoan: false,
			helbMonthlyDeduction: 0,
		},
		salaryStructure: {
			id: "structure_1",
			basicSalary: 100000,
			houseAllowance: 20000,
			transportAllowance: 0,
			commuterAllowance: 0,
			mealAllowance: 0,
			airtimeAllowance: 0,
			otherAllowances: 0,
			pensionEmployeeContribution: 0,
			pensionEmployerContribution: 0,
			mortgageInterestMonthly: 0,
			postRetirementMedicalMonthly: 0,
			insurancePremiumsMonthly: 0,
		},
		prorationInfo: {
			isProrated: false,
			proratedDays: 22,
			totalWorkingDays: 22,
			proratedReason: null,
			proratedFactor: 1,
		},
		overtimeRecord: null,
		leaveImpact: {
			unpaidLeaveDays: 0,
			halfPayLeaveDays: 0,
			workingDaysInMonth: 22,
		},
		loans: [],
		advances: [],
		bonuses: [],
		otherDeductions: [],
		rates,
		...overrides,
	};
}

describe("computeEmployeeSlip", () => {
	it("computes a standard full-month slip", () => {
		const result = computeEmployeeSlip(createInput());

		expect(result.success).toBe(true);
		if (!result.success) {
			return;
		}

		expect(result.data.slip.grossPay).toBe(120000);
		expect(result.data.slip.fullMonthGrossPay).toBe(120000);
		expect(result.data.slip.personalRelief).toBe(2400);
		expect(result.data.slip.totalVoluntaryDeductions).toBe(0);
		expect(result.data.warnings).toHaveLength(0);
	});

	it("applies unpaid leave to the prorated basic daily rate", () => {
		const result = computeEmployeeSlip(
			createInput({
				leaveImpact: {
					unpaidLeaveDays: 2,
					halfPayLeaveDays: 1,
					workingDaysInMonth: 22,
				},
			})
		);

		expect(result.success).toBe(true);
		if (!result.success) {
			return;
		}

		expect(result.data.slip.leaveDeductionAmount).toBe(11363.63);
		expect(result.data.slip.grossPay).toBe(108636.37);
		expect(result.data.warnings.some((warning) => warning.includes("Leave deduction applied"))).toBe(
			true
		);
	});

	it("adds overtime after proration", () => {
		const result = computeEmployeeSlip(
			createInput({
				overtimeRecord: {
					id: "ot_1",
					weekdayOvertimeHours: 4,
					weekendOvertimeHours: 0,
					publicHolidayOvertimeHours: 0,
					totalOvertimePay: 5000,
				},
			})
		);

		expect(result.success).toBe(true);
		if (!result.success) {
			return;
		}

		expect(result.data.slip.overtimePay).toBe(5000);
		expect(result.data.slip.grossPay).toBe(125000);
	});

	it("keeps personal relief unprorated for a new hire", () => {
		const result = computeEmployeeSlip(
			createInput({
				prorationInfo: {
					isProrated: true,
					proratedDays: 15,
					totalWorkingDays: 22,
					proratedReason: "new_hire",
					proratedFactor: 15 / 22,
				},
			})
		);

		expect(result.success).toBe(true);
		if (!result.success) {
			return;
		}

		expect(result.data.slip.basicSalary).toBe(68181.82);
		expect(result.data.slip.houseAllowance).toBe(13636.36);
		expect(result.data.slip.grossPay).toBe(81818.18);
		expect(result.data.slip.personalRelief).toBe(2400);
		expect(result.data.warnings.some((warning) => warning.includes("Proration applied"))).toBe(true);
	});

	it("computes statutory deductions from the prorated gross on termination", () => {
		const fullMonth = computeEmployeeSlip(createInput());
		const terminated = computeEmployeeSlip(
			createInput({
				prorationInfo: {
					isProrated: true,
					proratedDays: 15,
					totalWorkingDays: 22,
					proratedReason: "termination",
					proratedFactor: 15 / 22,
				},
			})
		);

		expect(fullMonth.success).toBe(true);
		expect(terminated.success).toBe(true);
		if (!fullMonth.success || !terminated.success) {
			return;
		}

		expect(terminated.data.slip.grossPay).toBeLessThan(fullMonth.data.slip.grossPay);
		expect(terminated.data.slip.netPaye).toBeLessThan(fullMonth.data.slip.netPaye);
	});

	it("reduces other deductions before advances and loans under the two-thirds cap", () => {
		const result = computeEmployeeSlip(
			createInput({
				salaryStructure: {
					...createInput().salaryStructure,
					basicSalary: 30000,
					houseAllowance: 0,
				},
				loans: [
					{
						loanId: "loan_1",
						monthlyInstalment: 15000,
						description: "Company loan",
					},
				],
				advances: [
					{
						advanceId: "advance_1",
						recoveryAmount: 10000,
						description: "Salary advance",
					},
				],
				otherDeductions: [
					{
						type: "sacco",
						amount: 5000,
						description: "Sacco",
					},
				],
			})
		);

		expect(result.success).toBe(true);
		if (!result.success) {
			return;
		}

		expect(result.data.slip.twoThirdsCapApplied).toBe(true);
		expect(result.data.otherDeductionLines[0]?.appliedAmount).toBe(0);
		expect(result.data.advanceRecoveries[0]?.appliedAmount).toBeLessThan(10000);
		expect(result.data.loanDeductions[0]?.appliedAmount).toBe(15000);
	});

	it("applies two-thirds cap on a prorated slip when loan obligations exceed the cap", () => {
		// Prorated basicSalary ≈ 20,454.55 → two-thirds cap ≈ 13,636.37
		// Statutory deductions + 15,000 loan instalment exceed that threshold.
		const result = computeEmployeeSlip(
			createInput({
				prorationInfo: {
					isProrated: true,
					proratedDays: 15,
					totalWorkingDays: 22,
					proratedReason: "new_hire",
					proratedFactor: 15 / 22,
				},
				salaryStructure: {
					...createInput().salaryStructure,
					basicSalary: 30000,
					houseAllowance: 0,
				},
				loans: [
					{
						loanId: "loan_1",
						monthlyInstalment: 15000,
						description: "Company loan",
					},
				],
			})
		);

		expect(result.success).toBe(true);
		if (!result.success) return;

		expect(result.data.slip.isProrated).toBe(true);
		expect(result.data.slip.twoThirdsCapApplied).toBe(true);
		expect(result.data.loanDeductions[0]?.appliedAmount).toBeLessThan(15000);
		expect(result.data.slip.netPay).toBeGreaterThan(0);
		expect(
			result.data.warnings.some(
				(w) => w.toLowerCase().includes("cap") && w.toLowerCase().includes("prorated")
			)
		).toBe(true);
	});

	it("fails when deductions drive net pay below zero", () => {
		const result = computeEmployeeSlip(
			createInput({
				employee: {
					id: "employee_1",
					hasHelbLoan: true,
					helbMonthlyDeduction: 20000,
				},
				salaryStructure: {
					...createInput().salaryStructure,
					basicSalary: 10000,
					houseAllowance: 0,
				},
				loans: [
					{
						loanId: "loan_1",
						monthlyInstalment: 0,
						description: "Company loan",
					},
				],
			})
		);

		expect(result.success).toBe(false);
		if (result.success) {
			return;
		}

		expect(result.error.message).toContain("two-thirds cap");
	});
});
