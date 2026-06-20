import { describe, expect, it } from "vitest";
import {
	buildPayrollRecognitionJournalLines,
	buildRemittanceCompletionStatus,
	buildRemittanceLineMemo,
	getJournalBalanceSummary,
	parseRemittanceLineMemoType,
} from "./payroll-journal-helpers";

const accountMappings = {
	salaries_expense: 1,
	overtime_expense: 2,
	bonus_expense: 3,
	nssf_employer_expense: 4,
	shif_employer_expense: 5,
	ahl_employer_expense: 6,
	nita_expense: 7,
	pension_employer_expense: 8,
	loans_receivable: 9,
	salary_advance_receivable: 10,
	paye_payable: 11,
	nssf_payable: 12,
	shif_payable: 13,
	ahl_payable: 14,
	nita_payable: 15,
	helb_payable: 16,
	loan_deductions_payable: 17,
	other_deductions_payable: 18,
	net_salaries_payable: 19,
	salary_advance_payable: 20,
} as const;

describe("buildPayrollRecognitionJournalLines", () => {
	it("omits zero-amount lines and preserves sequential numbering", () => {
		const lines = buildPayrollRecognitionJournalLines(
			{
				totalGrossPay: 1000,
				totalNssfEmployer: 0,
				totalShifEmployer: 25,
				totalAhlEmployer: 0,
				totalNitaLevy: 50,
				totalPensionEmployer: 0,
				totalNetPaye: 100,
				totalNssfEmployee: 0,
				totalShifEmployee: 25,
				totalAhlEmployee: 0,
				totalHelb: 0,
				totalLoanDeductions: 0,
				totalAdvanceRecoveries: 0,
				totalOtherDeductions: 0,
				totalNetPay: 850,
			},
			accountMappings,
			"June 2026"
		);

		expect(lines).toHaveLength(7);
		expect(lines.map((line) => line.lineNumber)).toEqual([1, 2, 3, 4, 5, 6, 7]);
		expect(lines.every((line) => line.amount > 0)).toBe(true);
	});

	it("surfaces the advance-recovery gap in balance totals", () => {
		const lines = buildPayrollRecognitionJournalLines(
			{
				totalGrossPay: 1000,
				totalNssfEmployer: 0,
				totalShifEmployer: 0,
				totalAhlEmployer: 0,
				totalNitaLevy: 0,
				totalPensionEmployer: 0,
				totalNetPaye: 0,
				totalNssfEmployee: 0,
				totalShifEmployee: 0,
				totalAhlEmployee: 0,
				totalHelb: 0,
				totalLoanDeductions: 0,
				totalAdvanceRecoveries: 100,
				totalOtherDeductions: 0,
				totalNetPay: 900,
			},
			accountMappings,
			"June 2026"
		);

		const balance = getJournalBalanceSummary(lines);

		expect(balance.isBalanced).toBe(false);
		expect(balance.totalDebits).toBe(1000);
		expect(balance.totalCredits).toBe(900);
		expect(balance.difference).toBe(100);
	});
});

describe("remittance memo helpers", () => {
	it("round-trips statutory item types through line memos", () => {
		const memo = buildRemittanceLineMemo("paye", "June 2026");

		expect(parseRemittanceLineMemoType(memo)).toBe("paye");
		expect(parseRemittanceLineMemoType("Payroll June 2026")).toBeNull();
	});
});

describe("buildRemittanceCompletionStatus", () => {
	it("marks zero-required items complete and keeps partial items outstanding", () => {
		const status = buildRemittanceCompletionStatus(
			{
				paye: 100,
				nssf: 0,
				shif: 50,
				ahl: 0,
				nita: 25,
				helb: 0,
			},
			{
				paye: 100,
				nssf: 0,
				shif: 10,
				ahl: 0,
				nita: 25,
				helb: 0,
			}
		);

		expect(status.isFullyRemitted).toBe(false);
		expect(status.items.find((item) => item.type === "nssf")?.isComplete).toBe(true);
		expect(status.items.find((item) => item.type === "shif")?.outstandingAmount).toBe(40);
	});
});
