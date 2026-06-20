import { describe, expect, it } from "vitest";
import {
	computeFullPayrollDeductions,
	computeGrossTax,
	computeNSSF,
	computeNetPAYE,
	computeSHIF,
} from "@/features/payroll/lib/paye-engine";
import { resolveStatutoryRatesSync } from "@/features/payroll/lib/payroll-rate-resolver";

const rates = resolveStatutoryRatesSync(new Date("2026-06-17T00:00:00.000Z"));

describe("paye engine", () => {
	it("floors taxable tax outcomes at zero", () => {
		const grossTax = computeGrossTax(0, rates);
		const netPaye = computeNetPAYE(0, rates.personalRelief, 0);

		expect(grossTax.grossTax).toBe(0);
		expect(netPaye.netPAYE).toBe(0);
	});

	it("computes PAYE through the top band progressively", () => {
		const result = computeGrossTax(900000, rates);

		expect(result.grossTax).toBe(277283.35);
		expect(result.bandBreakdown).toHaveLength(5);
		expect(result.bandBreakdown.at(-1)?.taxAmount).toBe(35000);
	});

	it("caps NSSF at the configured statutory maximum", () => {
		const result = computeNSSF(200000, rates);

		expect(result.employeeContribution).toBe(4320);
		expect(result.employerContribution).toBe(4320);
		expect(result.tier1Employee).toBe(480);
		expect(result.tier2Employee).toBe(3840);
	});

	it("keeps SHIF employer contribution at zero while preserving employee computation", () => {
		const minimumResult = computeSHIF(5000, rates);
		const uncappedResult = computeSHIF(200000, rates);

		expect(minimumResult.employeeContribution).toBe(300);
		expect(minimumResult.employerContribution).toBe(0);
		expect(uncappedResult.employeeContribution).toBe(5500);
		expect(uncappedResult.employerContribution).toBe(0);
	});

	it("floors net PAYE at zero after reliefs", () => {
		const result = computeNetPAYE(2000, rates.personalRelief, 1000);

		expect(result.netPAYE).toBe(0);
	});

	it("returns a complete payroll breakdown", () => {
		const result = computeFullPayrollDeductions(
			120000,
			{
				pensionEmployeeContribution: 12000,
				pensionEmployerContribution: 12000,
				mortgageInterestMonthly: 10000,
				postRetirementMedicalMonthly: 5000,
				insurancePremiumsMonthly: 6000,
				mealAllowance: 3000,
				airtimeAllowance: 4000,
			},
			rates
		);

		expect(result.taxableIncome).toBeGreaterThan(0);
		expect(result.netPAYE).toBeGreaterThanOrEqual(0);
		expect(result.totalEmployerCost).toBeGreaterThan(result.grossPay);
		expect(result.totalStatutoryDeductions).toBe(
			result.nssfEmployee + result.shifEmployee + result.ahlEmployee + result.netPAYE
		);
	});
});
