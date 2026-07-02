export type LoanSummarySourceRow = {
	approvedAmount: number | null;
	disbursementDate: string | null;
	fullName: string;
	id: string;
	instalmentsPaid: number;
	monthlyInstalment: number | null;
	outstandingBalance: number | null;
	principalAmount: number;
	status: string;
	totalInterestPaid: number;
	totalPrincipalPaid: number;
};

export type LoanSummaryReportRow = {
	disbursementDate: string | null;
	employeeName: string;
	instalmentsPaid: number;
	loanId: string;
	monthlyInstalment: number;
	originalAmount: number;
	outstandingBalance: number;
	status: string;
	totalRepaid: number;
};

export type LoanSummaryTotals = {
	originalAmount: number;
	outstandingBalance: number;
	totalRepaid: number;
};

export type LoanStatementDetailSource = {
	annualInterestRate: number;
	approvedAmount: number | null;
	approvedInstalments: number | null;
	disbursementDate: string | null;
	employeeNo: string;
	fullName: string;
	id: string;
	instalmentsPaid: number;
	outstandingBalance: number | null;
	principalAmount: number;
	repaymentStartMonth: number | null;
	repaymentStartYear: number | null;
	requestedInstalments: number;
	status: string;
};

export type LoanStatementRepaymentSource = {
	periodMonth: number;
	periodYear: number;
};

export type LoanStatementLedgerEntrySource = {
	balanceAfter: number;
	balanceBefore: number;
	date: string;
	interest: number;
	isEarlySettlement: boolean;
	principal: number;
	total: number;
};

export type LoanStatementRow = {
	balanceAfter: number;
	balanceBefore: number;
	date: string;
	index: number;
	interestComponent: number;
	isEarlySettlement: boolean;
	periodMonth: number | null;
	periodYear: number | null;
	principalComponent: number;
	totalPayment: number;
};

export type LoanStatementCurrentPosition = {
	instalmentsRemaining: number;
	outstandingBalance: number;
	status: string;
};

export type LoanStatementTotals = {
	totalInterestPaid: number;
	totalPaid: number;
	totalPrincipalPaid: number;
};

export function buildLoanSummaryReport(rows: Array<LoanSummarySourceRow>) {
	const reportRows: Array<LoanSummaryReportRow> = rows.map((row) => ({
		loanId: row.id,
		employeeName: row.fullName,
		disbursementDate: row.disbursementDate,
		originalAmount: row.approvedAmount ?? row.principalAmount,
		monthlyInstalment: row.monthlyInstalment ?? 0,
		totalRepaid: row.totalPrincipalPaid + row.totalInterestPaid,
		outstandingBalance: row.outstandingBalance ?? 0,
		instalmentsPaid: row.instalmentsPaid,
		status: row.status,
	}));

	return {
		rows: reportRows,
		totals: computeLoanSummaryTotals(reportRows),
	};
}

export function computeLoanSummaryTotals(rows: Array<LoanSummaryReportRow>): LoanSummaryTotals {
	return rows.reduce<LoanSummaryTotals>(
		(acc, row) => {
			acc.originalAmount += row.originalAmount;
			acc.totalRepaid += row.totalRepaid;
			acc.outstandingBalance += row.outstandingBalance;
			return acc;
		},
		{
			originalAmount: 0,
			totalRepaid: 0,
			outstandingBalance: 0,
		}
	);
}

export function buildLoanStatementRows(
	repayments: Array<LoanStatementRepaymentSource>,
	entries: Array<LoanStatementLedgerEntrySource>
) {
	return entries.map<LoanStatementRow>((entry, index) => {
		const repayment = repayments[index];
		return {
			index: index + 1,
			date: entry.date,
			periodMonth: repayment?.periodMonth ?? null,
			periodYear: repayment?.periodYear ?? null,
			principalComponent: entry.principal,
			interestComponent: entry.interest,
			totalPayment: entry.total,
			balanceBefore: entry.balanceBefore,
			balanceAfter: entry.balanceAfter,
			isEarlySettlement: entry.isEarlySettlement,
		};
	});
}

export function computeLoanStatementTotals(rows: Array<LoanStatementRow>): LoanStatementTotals {
	return rows.reduce<LoanStatementTotals>(
		(acc, row) => {
			acc.totalPrincipalPaid += row.principalComponent;
			acc.totalInterestPaid += row.interestComponent;
			acc.totalPaid += row.totalPayment;
			return acc;
		},
		{
			totalPrincipalPaid: 0,
			totalInterestPaid: 0,
			totalPaid: 0,
		}
	);
}

export function computeLoanCurrentPosition(
	detail: Pick<
		LoanStatementDetailSource,
		"approvedInstalments" | "instalmentsPaid" | "outstandingBalance" | "requestedInstalments" | "status"
	>
): LoanStatementCurrentPosition {
	const approvedInstalments = detail.approvedInstalments ?? detail.requestedInstalments;
	return {
		outstandingBalance: detail.outstandingBalance ?? 0,
		instalmentsRemaining: Math.max(approvedInstalments - detail.instalmentsPaid, 0),
		status: detail.status,
	};
}
