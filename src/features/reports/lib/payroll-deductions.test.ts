import { describe, expect, it } from "vitest";
import {
	buildDeductionsReport,
	isValidDeductionsReportStatus,
	type SlipForDeductions,
	type VoluntaryDeductionSource,
} from "./payroll-deductions";

const period = {
	id: "period-1",
	name: "June 2026",
	periodMonth: 6,
	periodYear: 2026,
	status: "paid",
} as const;

function makeSlip(employeeNo: string, overrides?: Partial<SlipForDeductions>): SlipForDeductions {
	return {
		employeeNo,
		employeeName: `Employee ${employeeNo}`,
		netPaye: overrides?.netPaye ?? 5_000,
		nssfEmployee: overrides?.nssfEmployee ?? 4_320,
		shifEmployee: overrides?.shifEmployee ?? 1_650,
		ahlEmployee: overrides?.ahlEmployee ?? 900,
		helbDeduction: overrides?.helbDeduction ?? 0,
		...overrides,
	};
}

function makeVoluntary(
	employeeNo: string,
	deductionType: VoluntaryDeductionSource["deductionType"],
	amount: number,
	description = "Monthly deduction"
): VoluntaryDeductionSource {
	return {
		employeeNo,
		employeeName: `Employee ${employeeNo}`,
		deductionType,
		description,
		amount,
	};
}

describe("buildDeductionsReport", () => {
	describe("statutory section", () => {
		it("generates one row per non-zero statutory deduction per employee", () => {
			const slips = [makeSlip("EMP-001", { netPaye: 5_000, nssfEmployee: 4_320, helbDeduction: 0 })];
			const report = buildDeductionsReport({ period, slips, voluntaryDeductions: [] });
			const categories = report.statutory.rows.map((r) => r.category);
			expect(categories).toContain("PAYE");
			expect(categories).toContain("NSSF Employee");
			expect(categories).not.toContain("HELB");
		});

		it("excludes zero-amount statutory deductions", () => {
			const slips = [makeSlip("EMP-001", { netPaye: 0, nssfEmployee: 4_320 })];
			const report = buildDeductionsReport({ period, slips, voluntaryDeductions: [] });
			const categories = report.statutory.rows.map((r) => r.category);
			expect(categories).not.toContain("PAYE");
		});

		it("includes HELB row when helbDeduction is non-zero", () => {
			const slips = [makeSlip("EMP-001", { helbDeduction: 2_000 })];
			const report = buildDeductionsReport({ period, slips, voluntaryDeductions: [] });
			expect(report.statutory.rows.some((r) => r.category === "HELB")).toBe(true);
		});

		it("computes statutory subtotals correctly", () => {
			const slips = [
				makeSlip("EMP-001", { netPaye: 5_000, nssfEmployee: 4_320, shifEmployee: 1_650, ahlEmployee: 900, helbDeduction: 0 }),
				makeSlip("EMP-002", { netPaye: 8_000, nssfEmployee: 4_320, shifEmployee: 2_750, ahlEmployee: 1_500, helbDeduction: 1_000 }),
			];
			const report = buildDeductionsReport({ period, slips, voluntaryDeductions: [] });
			expect(report.statutory.totals.paye).toBe(13_000);
			expect(report.statutory.totals.nssfEmployee).toBe(8_640);
			expect(report.statutory.totals.shifEmployee).toBe(4_400);
			expect(report.statutory.totals.ahlEmployee).toBe(2_400);
			expect(report.statutory.totals.helb).toBe(1_000);
			expect(report.statutory.totals.subtotal).toBe(29_440);
		});
	});

	describe("voluntary section", () => {
		it("groups voluntary deductions by type", () => {
			const voluntary = [
				makeVoluntary("EMP-001", "company_loan", 5_000),
				makeVoluntary("EMP-002", "company_loan", 3_000),
				makeVoluntary("EMP-001", "sacco", 2_000),
			];
			const report = buildDeductionsReport({ period, slips: [], voluntaryDeductions: voluntary });
			expect(report.voluntary.groups).toHaveLength(2);
			const loanGroup = report.voluntary.groups.find((g) => g.deductionType === "company_loan")!;
			expect(loanGroup.rows).toHaveLength(2);
			expect(loanGroup.subtotal).toBe(8_000);
		});

		it("computes per-group subtotals correctly", () => {
			const voluntary = [
				makeVoluntary("EMP-001", "salary_advance", 10_000),
				makeVoluntary("EMP-002", "salary_advance", 5_000),
			];
			const report = buildDeductionsReport({ period, slips: [], voluntaryDeductions: voluntary });
			const group = report.voluntary.groups[0]!;
			expect(group.subtotal).toBe(15_000);
		});

		it("orders groups in canonical order", () => {
			const voluntary = [
				makeVoluntary("EMP-001", "sacco", 1_000),
				makeVoluntary("EMP-001", "company_loan", 2_000),
				makeVoluntary("EMP-001", "welfare", 500),
			];
			const report = buildDeductionsReport({ period, slips: [], voluntaryDeductions: voluntary });
			const types = report.voluntary.groups.map((g) => g.deductionType);
			expect(types.indexOf("company_loan")).toBeLessThan(types.indexOf("sacco"));
			expect(types.indexOf("sacco")).toBeLessThan(types.indexOf("welfare"));
		});

		it("computes voluntary total as sum of all group subtotals", () => {
			const voluntary = [
				makeVoluntary("EMP-001", "company_loan", 5_000),
				makeVoluntary("EMP-002", "sacco", 2_000),
			];
			const report = buildDeductionsReport({ period, slips: [], voluntaryDeductions: voluntary });
			expect(report.voluntary.total).toBe(7_000);
		});
	});

	describe("grand total", () => {
		it("grand total equals statutory subtotal plus voluntary total", () => {
			const slips = [makeSlip("EMP-001", { netPaye: 5_000, nssfEmployee: 4_320, shifEmployee: 1_650, ahlEmployee: 900, helbDeduction: 0 })];
			const voluntary = [makeVoluntary("EMP-001", "company_loan", 3_000)];
			const report = buildDeductionsReport({ period, slips, voluntaryDeductions: voluntary });

			expect(report.grandTotal).toBe(report.statutory.totals.subtotal + report.voluntary.total);
		});

		it("grand total is zero when there are no slips or voluntary deductions", () => {
			const report = buildDeductionsReport({ period, slips: [], voluntaryDeductions: [] });
			expect(report.grandTotal).toBe(0);
		});
	});

	describe("status validation", () => {
		it("accepts paid status", () => expect(isValidDeductionsReportStatus("paid")).toBe(true));
		it("accepts closed status", () => expect(isValidDeductionsReportStatus("closed")).toBe(true));
		it("rejects approved status", () => expect(isValidDeductionsReportStatus("approved")).toBe(false));
		it("rejects draft status", () => expect(isValidDeductionsReportStatus("draft")).toBe(false));
		it("rejects cancelled status", () => expect(isValidDeductionsReportStatus("cancelled")).toBe(false));
	});
});
