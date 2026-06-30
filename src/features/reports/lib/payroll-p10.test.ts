import { describe, expect, it } from "vitest";
import { buildPayrollP10Report, isValidP10Status } from "./payroll-p10";

const period = {
	id: "period-1",
	name: "June 2026",
	periodMonth: 6,
	periodYear: 2026,
	payDate: "2026-06-30",
	status: "paid",
} as const;

function makeSlip(
	employeeNo: string,
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
	return {
		employeeNo,
		employeeName: `Employee ${employeeNo}`,
		kraPin: `A${employeeNo}Z`,
		basicSalary: overrides?.basicSalary ?? 50_000,
		grossPay: overrides?.grossPay ?? 60_000,
		nssfEmployee: overrides?.nssfEmployee ?? 4_320,
		pensionEmployeeDeduction: overrides?.pensionEmployeeDeduction ?? 0,
		ahlEmployee: overrides?.ahlEmployee ?? 900,
		shifEmployee: overrides?.shifEmployee ?? 1_650,
		postRetirementAllowableDeduction: overrides?.postRetirementAllowableDeduction ?? 0,
		mortgageAllowableDeduction: overrides?.mortgageAllowableDeduction ?? 0,
		grossTax: overrides?.grossTax ?? 8_000,
		personalRelief: overrides?.personalRelief ?? 2_400,
		insuranceRelief: overrides?.insuranceRelief ?? 0,
		netPaye: overrides?.netPaye ?? 5_600,
	};
}

describe("buildPayrollP10Report", () => {
	describe("totals row", () => {
		it("sums all numeric columns correctly across multiple employees", () => {
			const slips = [
				makeSlip("EMP-001", {
					basicSalary: 50_000,
					grossPay: 60_000,
					nssfEmployee: 4_320,
					ahlEmployee: 900,
					shifEmployee: 1_650,
					grossTax: 8_000,
					personalRelief: 2_400,
					netPaye: 5_600,
				}),
				makeSlip("EMP-002", {
					basicSalary: 80_000,
					grossPay: 100_000,
					nssfEmployee: 4_320,
					pensionEmployeeDeduction: 10_000,
					ahlEmployee: 1_500,
					shifEmployee: 2_750,
					grossTax: 22_000,
					personalRelief: 2_400,
					insuranceRelief: 500,
					netPaye: 19_100,
				}),
			];

			const report = buildPayrollP10Report({ period, slips });

			expect(report.totals.basicSalary).toBe(130_000);
			expect(report.totals.totalGrossPay).toBe(160_000);
			expect(report.totals.taxCharged).toBe(30_000);
			expect(report.totals.personalRelief).toBe(4_800);
			expect(report.totals.insuranceRelief).toBe(500);
			expect(report.totals.payeTax).toBe(24_700);
			expect(report.totals.ahlEmployee).toBe(2_400);
			expect(report.totals.shifEmployee).toBe(4_400);
		});

		it("totals chargeable pay matches sum of individual chargeable pays", () => {
			const slips = [
				makeSlip("EMP-001", { basicSalary: 50_000, grossPay: 60_000, nssfEmployee: 4_320, ahlEmployee: 900, shifEmployee: 1_650 }),
				makeSlip("EMP-002", { basicSalary: 30_000, grossPay: 35_000, nssfEmployee: 2_160, ahlEmployee: 525, shifEmployee: 962.5 }),
			];

			const report = buildPayrollP10Report({ period, slips });

			const summedChargeable = report.rows.reduce((acc, row) => acc + (row.chargeablePay ?? 0), 0);
			expect(report.totals.chargeablePay).toBeCloseTo(summedChargeable, 2);
		});

		it("totals payeTax reconciles with taxCharged minus personalRelief minus insuranceRelief per employee", () => {
			const slips = [
				makeSlip("EMP-001", { grossTax: 8_000, personalRelief: 2_400, insuranceRelief: 0, netPaye: 5_600 }),
				makeSlip("EMP-002", { grossTax: 22_000, personalRelief: 2_400, insuranceRelief: 500, netPaye: 19_100 }),
			];

			const report = buildPayrollP10Report({ period, slips });

			expect(report.totals.payeTax).toBe(report.totals.taxCharged - report.totals.personalRelief - report.totals.insuranceRelief);
		});
	});

	describe("status validation", () => {
		it("accepts paid status", () => {
			expect(isValidP10Status("paid")).toBe(true);
		});

		it("accepts closed status", () => {
			expect(isValidP10Status("closed")).toBe(true);
		});

		it("rejects approved status", () => {
			expect(isValidP10Status("approved")).toBe(false);
		});

		it("rejects draft status", () => {
			expect(isValidP10Status("draft")).toBe(false);
		});

		it("rejects processing status", () => {
			expect(isValidP10Status("processing")).toBe(false);
		});

		it("rejects cancelled status", () => {
			expect(isValidP10Status("cancelled")).toBe(false);
		});
	});

	describe("row structure", () => {
		it("returns one row per employee in the order provided", () => {
			const slips = [makeSlip("EMP-001"), makeSlip("EMP-002"), makeSlip("EMP-003")];
			const report = buildPayrollP10Report({ period, slips });
			expect(report.rows).toHaveLength(3);
			expect(report.rows.map((r) => r.employeeNo)).toEqual(["EMP-001", "EMP-002", "EMP-003"]);
		});

		it("propagates kraPin to each row", () => {
			const slips = [makeSlip("EMP-001")];
			const report = buildPayrollP10Report({ period, slips });
			expect(report.rows[0]!.kraPin).toBe("AEMP-001Z");
		});

		it("includes period and employer in the report", () => {
			const report = buildPayrollP10Report({ period, slips: [] });
			expect(report.period.periodMonth).toBe(6);
			expect(report.period.periodYear).toBe(2026);
			expect(report.employer.name).toBeTruthy();
			expect(report.employer.kraPin).toBeTruthy();
		});
	});
});
