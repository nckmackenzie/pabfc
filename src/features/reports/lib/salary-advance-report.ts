import { formatText } from "@/features/employees/utils/helpers";

export type SalaryAdvanceSummarySourceRow = {
	applicationDate: string;
	approvedAmount: number | null;
	approvedRecoveryMonths: number | null;
	disbursementDate: string | null;
	fullName: string;
	id: string;
	monthlyRecoveryAmount: number | null;
	outstandingBalance: number | null;
	recoveriesProcessed: number;
	status: string;
	totalRecovered: number;
};

export type SalaryAdvanceSummaryReportRow = {
	advanceId: string;
	applicationDate: string;
	approvedAmount: number;
	approvedRecoveryMonths: number;
	disbursementDate: string | null;
	employeeName: string;
	monthlyRecoveryAmount: number;
	outstandingBalance: number;
	recoveriesProcessed: number;
	recoveriesRemaining: number;
	status: string;
	totalRecovered: number;
};

export type SalaryAdvanceSummaryTotals = {
	approvedAmount: number;
	outstandingBalance: number;
	totalRecovered: number;
};

export type SalaryAdvanceStatementDetailSource = {
	applicationDate: string;
	approvedAmount: number | null;
	approvedRecoveryMonths: number | null;
	disbursementDate: string | null;
	employeeNo: string;
	fullName: string;
	id: string;
	monthlyRecoveryAmount: number | null;
	outstandingBalance: number | null;
	recoveriesProcessed: number;
	recoveryStartMonth: number | null;
	recoveryStartYear: number | null;
	status: string;
	totalRecovered: number;
};

export type SalaryAdvanceRecoverySource = {
	periodMonth: number;
	periodYear: number;
};

export type SalaryAdvanceStatementEntrySource = {
	amount: number;
	balanceAfter: number;
	balanceBefore: number;
	date: string;
	isLastRecovery: boolean;
};

export type SalaryAdvanceStatementRow = {
	amount: number;
	balanceAfter: number;
	balanceBefore: number;
	date: string;
	index: number;
	isLastRecovery: boolean;
	periodMonth: number | null;
	periodYear: number | null;
};

export const DEFAULT_ACTIVE_ADVANCE_STATUSES = ["disbursed", "recovering"] as const;

export function computeRecoveriesRemaining(
	approvedRecoveryMonths: number | null,
	recoveriesProcessed: number
) {
	return Math.max((approvedRecoveryMonths ?? 0) - recoveriesProcessed, 0);
}

export function resolveSalaryAdvanceStatuses(status?: string) {
	if (!status || status === "active") {
		return [...DEFAULT_ACTIVE_ADVANCE_STATUSES];
	}

	if (status === "all") {
		return null;
	}

	return [status];
}

export function buildSalaryAdvanceSummaryReport(rows: Array<SalaryAdvanceSummarySourceRow>) {
	const reportRows: Array<SalaryAdvanceSummaryReportRow> = rows.map((row) => ({
		advanceId: row.id,
		employeeName: row.fullName,
		applicationDate: row.applicationDate,
		disbursementDate: row.disbursementDate,
		approvedAmount: row.approvedAmount ?? 0,
		monthlyRecoveryAmount: row.monthlyRecoveryAmount ?? 0,
		totalRecovered: row.totalRecovered,
		outstandingBalance: row.outstandingBalance ?? 0,
		recoveriesProcessed: row.recoveriesProcessed,
		approvedRecoveryMonths: row.approvedRecoveryMonths ?? 0,
		recoveriesRemaining: computeRecoveriesRemaining(
			row.approvedRecoveryMonths,
			row.recoveriesProcessed
		),
		status: row.status,
	}));

	return {
		rows: reportRows,
		totals: reportRows.reduce<SalaryAdvanceSummaryTotals>(
			(acc, row) => {
				acc.approvedAmount += row.approvedAmount;
				acc.totalRecovered += row.totalRecovered;
				acc.outstandingBalance += row.outstandingBalance;
				return acc;
			},
			{
				approvedAmount: 0,
				totalRecovered: 0,
				outstandingBalance: 0,
			}
		),
	};
}

export function buildSalaryAdvanceStatementRows(
	recoveries: Array<SalaryAdvanceRecoverySource>,
	entries: Array<SalaryAdvanceStatementEntrySource>
) {
	return entries.map<SalaryAdvanceStatementRow>((entry, index) => {
		const recovery = recoveries[index];
		return {
			index: index + 1,
			date: entry.date,
			periodMonth: recovery?.periodMonth ?? null,
			periodYear: recovery?.periodYear ?? null,
			amount: entry.amount,
			balanceBefore: entry.balanceBefore,
			balanceAfter: entry.balanceAfter,
			isLastRecovery: entry.isLastRecovery,
		};
	});
}

export function buildSalaryAdvanceStatementCurrentPosition(
	detail: Pick<
		SalaryAdvanceStatementDetailSource,
		"approvedRecoveryMonths" | "outstandingBalance" | "recoveriesProcessed" | "status" | "totalRecovered"
	>
) {
	return {
		outstandingBalance: detail.outstandingBalance ?? 0,
		recoveriesProcessed: detail.recoveriesProcessed,
		recoveriesRemaining: computeRecoveriesRemaining(
			detail.approvedRecoveryMonths,
			detail.recoveriesProcessed
		),
		totalRecovered: detail.totalRecovered,
		status: detail.status,
	};
}

export function formatSalaryAdvanceStatus(status: string) {
	return formatText(status);
}
