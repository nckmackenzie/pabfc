import type {
	PayrollAccountRole,
	PayrollRemittanceItemType,
} from "@/features/payroll/lib/payroll-constants";
import { PAYROLL_REMITTANCE_ITEM_TYPES } from "@/features/payroll/lib/payroll-constants";
import type { payrollSlips } from "@/drizzle/schema";
import { roundDecimal, toBig, toNumber } from "@/lib/helpers";

export type PayrollJournalLineInput = {
	accountId: number;
	amount: number;
	dc: "debit" | "credit";
	lineNumber: number;
	memo: string;
};

export type PayrollRecognitionTotals = {
	totalGrossPay: number;
	totalNssfEmployer: number;
	totalShifEmployer: number;
	totalAhlEmployer: number;
	totalNitaLevy: number;
	totalPensionEmployer: number;
	totalNetPaye: number;
	totalNssfEmployee: number;
	totalShifEmployee: number;
	totalAhlEmployee: number;
	totalHelb: number;
	totalLoanDeductions: number;
	totalAdvanceRecoveries: number;
	totalOtherDeductions: number;
	totalNetPay: number;
};

export type RemittanceCompletionItem = {
	type: PayrollRemittanceItemType;
	requiredAmount: number;
	remittedAmount: number;
	outstandingAmount: number;
	isComplete: boolean;
};

export type RemittanceCompletionStatus = {
	items: RemittanceCompletionItem[];
	isFullyRemitted: boolean;
};

function getZeroAmountLineNumbers(lineInputs: Omit<PayrollJournalLineInput, "lineNumber">[]) {
	let lineNumber = 1;

	return lineInputs.flatMap((line) => {
		if (roundDecimal(line.amount) <= 0) {
			return [];
		}

		const numberedLine = {
			...line,
			amount: roundDecimal(line.amount),
			lineNumber,
		};
		lineNumber += 1;
		return [numberedLine];
	});
}

export function buildPayrollRecognitionJournalLines(
	totals: PayrollRecognitionTotals,
	accountMappings: Record<PayrollAccountRole, number>,
	periodName: string
) {
	return getZeroAmountLineNumbers([
		{
			accountId: accountMappings.salaries_expense,
			amount: totals.totalGrossPay,
			dc: "debit",
			memo: `Payroll ${periodName}`,
		},
		{
			accountId: accountMappings.nssf_employer_expense,
			amount: totals.totalNssfEmployer,
			dc: "debit",
			memo: `Payroll ${periodName}`,
		},
		{
			accountId: accountMappings.shif_employer_expense,
			amount: totals.totalShifEmployer,
			dc: "debit",
			memo: `Payroll ${periodName}`,
		},
		{
			accountId: accountMappings.ahl_employer_expense,
			amount: totals.totalAhlEmployer,
			dc: "debit",
			memo: `Payroll ${periodName}`,
		},
		{
			accountId: accountMappings.nita_expense,
			amount: totals.totalNitaLevy,
			dc: "debit",
			memo: `Payroll ${periodName}`,
		},
		{
			accountId: accountMappings.pension_employer_expense,
			amount: totals.totalPensionEmployer,
			dc: "debit",
			memo: `Payroll ${periodName}`,
		},
		{
			accountId: accountMappings.paye_payable,
			amount: totals.totalNetPaye,
			dc: "credit",
			memo: `Payroll ${periodName}`,
		},
		{
			accountId: accountMappings.nssf_payable,
			amount: totals.totalNssfEmployee + totals.totalNssfEmployer,
			dc: "credit",
			memo: `Payroll ${periodName}`,
		},
		{
			accountId: accountMappings.shif_payable,
			amount: totals.totalShifEmployee + totals.totalShifEmployer,
			dc: "credit",
			memo: `Payroll ${periodName}`,
		},
		{
			accountId: accountMappings.ahl_payable,
			amount: totals.totalAhlEmployee + totals.totalAhlEmployer,
			dc: "credit",
			memo: `Payroll ${periodName}`,
		},
		{
			accountId: accountMappings.nita_payable,
			amount: totals.totalNitaLevy,
			dc: "credit",
			memo: `Payroll ${periodName}`,
		},
		{
			accountId: accountMappings.helb_payable,
			amount: totals.totalHelb,
			dc: "credit",
			memo: `Payroll ${periodName}`,
		},
		{
			accountId: accountMappings.loan_deductions_payable,
			amount: totals.totalLoanDeductions,
			dc: "credit",
			memo: `Payroll ${periodName}`,
		},
		{
			accountId: accountMappings.salary_advance_payable,
			amount: totals.totalAdvanceRecoveries,
			dc: "credit",
			memo: `Payroll ${periodName}`,
		},
		{
			accountId: accountMappings.other_deductions_payable,
			amount: totals.totalOtherDeductions,
			dc: "credit",
			memo: `Payroll ${periodName}`,
		},
		{
			accountId: accountMappings.net_salaries_payable,
			amount: totals.totalNetPay,
			dc: "credit",
			memo: `Payroll ${periodName}`,
		},
	]);
}

export function getJournalBalanceSummary(
	lines: Array<{
		amount: number | string;
		dc: "debit" | "credit";
	}>
) {
	const debitTotal = lines.reduce((total, line) => {
		if (line.dc !== "debit") {
			return total;
		}

		return total.plus(toBig(line.amount));
	}, toBig(0));
	const creditTotal = lines.reduce((total, line) => {
		if (line.dc !== "credit") {
			return total;
		}

		return total.plus(toBig(line.amount));
	}, toBig(0));
	const difference = debitTotal.minus(creditTotal);

	return {
		totalDebits: roundDecimal(Number(debitTotal.toFixed(2))),
		totalCredits: roundDecimal(Number(creditTotal.toFixed(2))),
		difference: roundDecimal(Number(difference.toFixed(2))),
		isBalanced: difference.eq(0),
	};
}

export function buildRemittanceLineMemo(
	type: PayrollRemittanceItemType,
	periodName: string,
	reference?: string
) {
	const base = `Statutory remittance - ${type.toUpperCase()} - ${periodName}`;
	return reference ? `${base} - Ref ${reference}` : base;
}

export function buildRemittanceCompletionStatus(
	requiredAmounts: Record<PayrollRemittanceItemType, number>,
	remittedAmounts: Record<PayrollRemittanceItemType, number>
): RemittanceCompletionStatus {
	const items = PAYROLL_REMITTANCE_ITEM_TYPES.map((type) => {
		const requiredAmount = roundDecimal(requiredAmounts[type] ?? 0);
		const remittedAmount = roundDecimal(remittedAmounts[type] ?? 0);
		const outstandingAmount = roundDecimal(Math.max(requiredAmount - remittedAmount, 0));
		const isComplete = outstandingAmount <= 0;

		return {
			type,
			requiredAmount,
			remittedAmount,
			outstandingAmount,
			isComplete,
		};
	});

	return {
		items,
		isFullyRemitted: items.every((item) => item.isComplete),
	};
}

export function sumSlipTotals(
	rows: Array<typeof payrollSlips.$inferSelect>
): PayrollRecognitionTotals {
	return rows.reduce<PayrollRecognitionTotals>(
		(accumulator, slip) => ({
			totalGrossPay: roundDecimal(accumulator.totalGrossPay + toNumber(slip.grossPay)),
			totalNssfEmployer: roundDecimal(accumulator.totalNssfEmployer + toNumber(slip.nssfEmployer)),
			totalShifEmployer: roundDecimal(accumulator.totalShifEmployer + toNumber(slip.shifEmployer)),
			totalAhlEmployer: roundDecimal(accumulator.totalAhlEmployer + toNumber(slip.ahlEmployer)),
			totalNitaLevy: roundDecimal(accumulator.totalNitaLevy + toNumber(slip.nitaLevy)),
			totalPensionEmployer: roundDecimal(
				accumulator.totalPensionEmployer + toNumber(slip.pensionEmployerContribution)
			),
			totalNetPaye: roundDecimal(accumulator.totalNetPaye + toNumber(slip.netPaye)),
			totalNssfEmployee: roundDecimal(accumulator.totalNssfEmployee + toNumber(slip.nssfEmployee)),
			totalShifEmployee: roundDecimal(accumulator.totalShifEmployee + toNumber(slip.shifEmployee)),
			totalAhlEmployee: roundDecimal(accumulator.totalAhlEmployee + toNumber(slip.ahlEmployee)),
			totalHelb: roundDecimal(accumulator.totalHelb + toNumber(slip.helbDeduction)),
			totalLoanDeductions: roundDecimal(
				accumulator.totalLoanDeductions + toNumber(slip.totalLoanDeductions)
			),
			totalAdvanceRecoveries: roundDecimal(
				accumulator.totalAdvanceRecoveries + toNumber(slip.totalAdvanceRecoveries)
			),
			totalOtherDeductions: roundDecimal(
				accumulator.totalOtherDeductions + toNumber(slip.totalOtherDeductions)
			),
			totalNetPay: roundDecimal(accumulator.totalNetPay + toNumber(slip.netPay)),
		}),
		{
			totalGrossPay: 0,
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
			totalAdvanceRecoveries: 0,
			totalOtherDeductions: 0,
			totalNetPay: 0,
		}
	);
}

export function sumValues(values: Array<number | null | undefined>) {
	return roundDecimal(values.reduce<number>((total, value) => total + (value ?? 0), 0));
}
