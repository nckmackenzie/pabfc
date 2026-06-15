import { describe, expect, it } from "vitest";
import type { salaryStructures } from "@/drizzle/schema";
import {
	canAutoCloseCurrentStructure,
	computeGrossPayComponents,
	doSalaryRangesOverlap,
	getSalaryHistoryStatus,
	subtractOneDay,
} from "./helpers";

type SalaryStructureRecord = typeof salaryStructures.$inferSelect;

function createStructure(
	overrides: Partial<SalaryStructureRecord> = {},
): SalaryStructureRecord {
	return {
		id: 1,
		employeeId: "employee_1",
		effectiveFrom: "2026-01-01",
		effectiveTo: null,
		payFrequency: "monthly",
		basicSalary: "100000.00",
		houseAllowance: "15000.00",
		transportAllowance: "5000.00",
		commuterAllowance: "2500.00",
		mealAllowance: "6500.00",
		airtimeAllowance: "5500.00",
		otherAllowances: "2000.00",
		otherAllowancesDescription: null,
		pensionEmployeeContribution: "35000.00",
		pensionEmployerContribution: "10000.00",
		pensionFundName: "LAPTRUST",
		mortgageInterestMonthly: "31000.00",
		postRetirementMedicalMonthly: "20000.00",
		insurancePremiumsMonthly: "40000.00",
		hasHelbLoan: true,
		helbMonthlyDeduction: "1200.00",
		normalHoursPerDay: "8.00",
		normalDaysPerWeek: "5.00",
		overtimeHourlyRateDivisor: 225,
		isActive: true,
		notes: null,
		createdBy: "user_1",
		createdAt: new Date("2026-01-01T08:00:00.000Z"),
		updatedAt: new Date("2026-01-01T08:00:00.000Z"),
		...overrides,
	};
}

describe("payroll helpers", () => {
	it("computes gross pay breakdown and statutory caps", () => {
		const components = computeGrossPayComponents(createStructure());

		expect(components.grossPay).toBe(136500);
		expect(components.mealAllowanceExempt).toBe(5000);
		expect(components.mealAllowanceTaxable).toBe(1500);
		expect(components.airtimeAllowanceExempt).toBe(5000);
		expect(components.airtimeAllowanceTaxable).toBe(500);
		expect(components.pensionAllowableDeduction).toBe(30000);
		expect(components.mortgageAllowableDeduction).toBe(30000);
		expect(components.postRetirementAllowableDeduction).toBe(15000);
		expect(components.insurancePremiumsForRelief).toBe(33333.33);
		expect(components.overtimeHourlyRate).toBe(444.44);
		expect(components.helbMonthlyDeduction).toBe(1200);
	});

	it("resolves salary history status correctly", () => {
		expect(
			getSalaryHistoryStatus({
				effectiveFrom: "2026-08-01",
				effectiveTo: null,
				today: "2026-06-15",
			}),
		).toBe("future");

		expect(
			getSalaryHistoryStatus({
				effectiveFrom: "2026-01-01",
				effectiveTo: null,
				today: "2026-06-15",
			}),
		).toBe("active");

		expect(
			getSalaryHistoryStatus({
				effectiveFrom: "2025-01-01",
				effectiveTo: "2025-12-31",
				today: "2026-06-15",
			}),
		).toBe("superseded");
	});

	it("detects overlapping ranges and auto-close cases", () => {
		expect(
			doSalaryRangesOverlap({
				existingEffectiveFrom: "2026-01-01",
				existingEffectiveTo: null,
				newEffectiveFrom: "2026-07-01",
				newEffectiveTo: null,
			}),
		).toBe(true);

		expect(
			doSalaryRangesOverlap({
				existingEffectiveFrom: "2026-01-01",
				existingEffectiveTo: "2026-06-30",
				newEffectiveFrom: "2026-07-01",
				newEffectiveTo: null,
			}),
		).toBe(false);

		expect(
			canAutoCloseCurrentStructure({
				existingEffectiveFrom: "2026-01-01",
				existingEffectiveTo: null,
				newEffectiveFrom: "2026-07-01",
			}),
		).toBe(true);
	});

	it("subtracts one day from an iso date", () => {
		expect(subtractOneDay("2026-07-01")).toBe("2026-06-30");
	});
});
