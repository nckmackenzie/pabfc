import { describe, expect, it } from "vitest";
import { P9_E3_FIXED, buildPayrollP9Report } from "./payroll-p9";

const employee = {
	employeeNo: "EMP-001",
	firstName: "Jane",
	lastName: "Doe",
	kraPin: "A012345678Z",
	hireDate: "2026-01-01",
	terminationDate: null,
} as const;

function createMonth(
	periodMonth: number,
	overrides?: Partial<{
		basicSalary: number;
		grossPay: number;
		nssfEmployee: number;
		pensionEmployeeDeduction: number;
		ahlEmployee: number;
		shifEmployee: number;
		postRetirementAllowableDeduction: number;
		mortgageAllowableDeduction: number;
		grossTax: number;
		personalRelief: number;
		insuranceRelief: number;
		netPaye: number;
	}>
) {
	const basicSalary = overrides?.basicSalary ?? 50_000;
	return {
		periodMonth,
		basicSalary,
		grossPay: overrides?.grossPay ?? 60_000,
		nssfEmployee: overrides?.nssfEmployee ?? 4320,
		pensionEmployeeDeduction: overrides?.pensionEmployeeDeduction ?? 0,
		ahlEmployee: overrides?.ahlEmployee ?? 900,
		shifEmployee: overrides?.shifEmployee ?? 1650,
		postRetirementAllowableDeduction: overrides?.postRetirementAllowableDeduction ?? 0,
		mortgageAllowableDeduction: overrides?.mortgageAllowableDeduction ?? 0,
		grossTax: overrides?.grossTax ?? 8_000,
		personalRelief: overrides?.personalRelief ?? 2400,
		insuranceRelief: overrides?.insuranceRelief ?? 0,
		netPaye: overrides?.netPaye ?? 5_600,
	};
}

describe("buildPayrollP9Report", () => {
	describe("E column computation (min of E1, E2, E3)", () => {
		it("E2 is the binding minimum when actual pension is lowest", () => {
			// basicSalary = 10,000 → E1 = 3,000; E2 = nssf 480 + pension 0 = 480; E3 = 30,000
			const month = createMonth(1, {
				basicSalary: 10_000,
				grossPay: 10_000,
				nssfEmployee: 480,
				pensionEmployeeDeduction: 0,
			});
			const report = buildPayrollP9Report({
				employee,
				taxYear: 2026,
				closedMonths: [month],
			});
			const row = report.rows[0];
			expect(row?.e1ThirtyPctBasic).toBe(3_000);
			expect(row?.e2ActualPension).toBe(480);
			expect(row?.e3Fixed).toBe(30_000);
			// J uses E = min(3000, 480, 30000) = 480; F=900 (default AHL), G=1650 (default SHIF)
			expect(row?.totalDeductions).toBeCloseTo(480 + 900 + 1650, 1);
		});

		it("E1 (30% of basic) is the binding minimum", () => {
			// basicSalary = 5,000 → E1 = 1,500; E2 = 4,320+5,000 = 9,320; E3 = 30,000
			const month = createMonth(1, {
				basicSalary: 5_000,
				grossPay: 10_000,
				nssfEmployee: 4_320,
				pensionEmployeeDeduction: 5_000,
				ahlEmployee: 150,
				shifEmployee: 275,
			});
			const report = buildPayrollP9Report({
				employee,
				taxYear: 2026,
				closedMonths: [month],
			});
			const row = report.rows[0];
			expect(row?.e1ThirtyPctBasic).toBe(1_500);
			expect(row?.e2ActualPension).toBe(9_320);
			expect(row?.e3Fixed).toBe(30_000);
			// E effective = 1,500 (E1 is smallest)
			expect(row?.totalDeductions).toBe(1_500 + 150 + 275);
		});

		it("E3 (30,000) is the binding minimum when actual pension is very high", () => {
			// basicSalary = 200,000 → E1 = 60,000; E2 = 4,320 + 50,000 = 54,320; E3 = 30,000
			const month = createMonth(1, {
				basicSalary: 200_000,
				grossPay: 220_000,
				nssfEmployee: 4_320,
				pensionEmployeeDeduction: 50_000,
				ahlEmployee: 3_300,
				shifEmployee: 6_050,
			});
			const report = buildPayrollP9Report({
				employee,
				taxYear: 2026,
				closedMonths: [month],
			});
			const row = report.rows[0];
			// E effective = 30,000 (E3 is smallest)
			expect(row?.totalDeductions).toBe(30_000 + 3_300 + 6_050);
		});

		it("E2 includes both NSSF and company pension deduction", () => {
			const month = createMonth(1, {
				basicSalary: 100_000,
				grossPay: 120_000,
				nssfEmployee: 4_320,
				pensionEmployeeDeduction: 10_000,
			});
			const report = buildPayrollP9Report({
				employee,
				taxYear: 2026,
				closedMonths: [month],
			});
			const row = report.rows[0];
			expect(row?.e2ActualPension).toBe(14_320); // 4320 + 10000
		});
	});

	describe("J — total deductions", () => {
		it("J = E_effective + F + G + H + I", () => {
			const month = createMonth(1, {
				basicSalary: 50_000,
				grossPay: 60_000,
				nssfEmployee: 4_320,
				pensionEmployeeDeduction: 0,
				ahlEmployee: 900,
				shifEmployee: 1_650,
				postRetirementAllowableDeduction: 5_000,
				mortgageAllowableDeduction: 10_000,
			});
			const report = buildPayrollP9Report({
				employee,
				taxYear: 2026,
				closedMonths: [month],
			});
			const row = report.rows[0];
			// E1=15000, E2=4320, E3=30000 → E_eff=4320
			expect(row?.totalDeductions).toBeCloseTo(4_320 + 900 + 1_650 + 5_000 + 10_000, 1);
		});
	});

	describe("K — chargeable pay", () => {
		it("K = D − J", () => {
			const month = createMonth(1, {
				basicSalary: 50_000,
				grossPay: 60_000,
				nssfEmployee: 4_320,
				ahlEmployee: 900,
				shifEmployee: 1_650,
			});
			const report = buildPayrollP9Report({
				employee,
				taxYear: 2026,
				closedMonths: [month],
			});
			const row = report.rows[0];
			const expectedJ = (row?.totalDeductions ?? 0);
			expect(row?.chargeablePay).toBeCloseTo(60_000 - expectedJ, 1);
		});

		it("K is never negative", () => {
			// Extreme deductions — J > D
			const month = createMonth(1, {
				basicSalary: 5_000,
				grossPay: 5_000,
				nssfEmployee: 300,
				ahlEmployee: 75,
				shifEmployee: 138,
				mortgageAllowableDeduction: 30_000, // cap already applied in DB
			});
			const report = buildPayrollP9Report({
				employee,
				taxYear: 2026,
				closedMonths: [month],
			});
			const row = report.rows[0];
			expect(row?.chargeablePay).toBeGreaterThanOrEqual(0);
		});
	});

	describe("blank row logic", () => {
		it("months without a closed period render as blank rows", () => {
			const report = buildPayrollP9Report({
				employee,
				taxYear: 2026,
				closedMonths: [1, 2, 3].map((m) => createMonth(m)),
			});
			expect(report.rows.slice(0, 3).every((r) => r.totalGrossPay !== null)).toBe(true);
			expect(report.rows.slice(3).every((r) => r.totalGrossPay === null)).toBe(true);
		});

		it("blank rows carry null for B and C (gaps) like all other nulls", () => {
			const report = buildPayrollP9Report({
				employee,
				taxYear: 2026,
				closedMonths: [],
			});
			for (const row of report.rows) {
				expect(row.benefitsNonCash).toBeNull();
				expect(row.valueOfQuarters).toBeNull();
				expect(row.totalGrossPay).toBeNull();
			}
		});
	});

	describe("populated row — B and C are always null (gaps)", () => {
		it("benefitsNonCash and valueOfQuarters are null even for populated months", () => {
			const report = buildPayrollP9Report({
				employee,
				taxYear: 2026,
				closedMonths: [createMonth(1)],
			});
			expect(report.rows[0]?.benefitsNonCash).toBeNull();
			expect(report.rows[0]?.valueOfQuarters).toBeNull();
		});
	});

	describe("E3 fixed value", () => {
		it("e3Fixed is always P9_E3_FIXED (30,000) for populated rows", () => {
			const report = buildPayrollP9Report({
				employee,
				taxYear: 2026,
				closedMonths: Array.from({ length: 12 }, (_, i) => createMonth(i + 1)),
			});
			for (const row of report.rows) {
				expect(row.e3Fixed).toBe(P9_E3_FIXED);
			}
		});
	});

	describe("totals", () => {
		it("sums all columns over 12 active months", () => {
			const months = Array.from({ length: 12 }, (_, i) =>
				createMonth(i + 1, {
					basicSalary: 50_000,
					grossPay: 60_000,
					nssfEmployee: 4_320,
					pensionEmployeeDeduction: 0,
					ahlEmployee: 900,
					shifEmployee: 1_650,
					grossTax: 8_000,
					personalRelief: 2_400,
					insuranceRelief: 0,
					netPaye: 5_600,
				})
			);
			const report = buildPayrollP9Report({ employee, taxYear: 2026, closedMonths: months });
			expect(report.totals.basicSalary).toBe(50_000 * 12);
			expect(report.totals.totalGrossPay).toBe(60_000 * 12);
			expect(report.totals.e3Fixed).toBe(30_000 * 12);
			expect(report.totals.ahlEmployee).toBe(900 * 12);
			expect(report.totals.shifEmployee).toBe(1_650 * 12);
			expect(report.totals.taxCharged).toBe(8_000 * 12);
			expect(report.totals.personalRelief).toBe(2_400 * 12);
			expect(report.totals.payeTax).toBe(5_600 * 12);
			expect(report.totals.benefitsNonCash).toBe(0); // gap column
			expect(report.totals.valueOfQuarters).toBe(0); // gap column
		});

		it("blank months do not contribute to totals", () => {
			const report = buildPayrollP9Report({
				employee,
				taxYear: 2026,
				closedMonths: [createMonth(1)],
			});
			expect(report.totals.totalGrossPay).toBe(60_000);
			expect(report.monthsWithPayrollActivity).toBe(1);
		});
	});

	describe("employee summary", () => {
		it("returns firstName and lastName separately", () => {
			const report = buildPayrollP9Report({
				employee,
				taxYear: 2026,
				closedMonths: [],
			});
			expect(report.employee.firstName).toBe("Jane");
			expect(report.employee.lastName).toBe("Doe");
			expect(report.employee.name).toBe("Jane Doe");
		});
	});

	describe("monthsWithClosedPeriods and monthsWithPayrollActivity", () => {
		it("tracks closed periods even when employee has no slip", () => {
			const report = buildPayrollP9Report({
				employee,
				taxYear: 2026,
				closedMonths: [
					{ periodMonth: 1, basicSalary: null, grossPay: null, nssfEmployee: null, pensionEmployeeDeduction: null, ahlEmployee: null, shifEmployee: null, postRetirementAllowableDeduction: null, mortgageAllowableDeduction: null, grossTax: null, personalRelief: null, insuranceRelief: null, netPaye: null },
					createMonth(2),
				],
			});
			expect(report.monthsWithClosedPeriods).toBe(2);
			expect(report.monthsWithPayrollActivity).toBe(1);
		});
	});
});
