import { formatText } from "@/features/employees/utils/helpers";

export type LeaveUtilisationSourceRow = {
	adjustmentDays: number;
	carryForwardExpiresAt: Date | string | null;
	carriedForwardDays: number;
	departmentName: string | null;
	employeeId: string;
	employeeName: string;
	employeeNo: string;
	entitledDays: number;
	leaveType: string;
	takenDays: number;
};

export type LeaveUtilisationReportRow = {
	adjustmentDays: number;
	availableBalance: number;
	carryForwardExpiresAt: string | null;
	carriedForwardDays: number;
	departmentName: string | null;
	employeeId: string;
	employeeName: string;
	employeeNo: string;
	entitledDays: number;
	leaveType: string;
	leaveTypeLabel: string;
	takenDays: number;
};

export type LeaveUtilisationEmployeeSummary = {
	departmentName: string | null;
	employeeId: string;
	employeeName: string;
	employeeNo: string;
	totalAvailable: number;
	totalEntitled: number;
	totalTaken: number;
};

export type LeaveUtilisationTotals = {
	totalAvailable: number;
	totalEntitled: number;
	totalTaken: number;
};

export function computeLeaveAvailableBalance({
	entitledDays,
	carriedForwardDays,
	adjustmentDays,
	takenDays,
}: {
	adjustmentDays: number;
	carriedForwardDays: number;
	entitledDays: number;
	takenDays: number;
}) {
	return entitledDays + carriedForwardDays + adjustmentDays - takenDays;
}

export function buildLeaveUtilisationReport(
	rows: Array<LeaveUtilisationSourceRow>,
	leaveYear: number
) {
	const detailRows = rows
		.filter((row) => !(row.entitledDays === 0 && row.takenDays === 0))
		.map<LeaveUtilisationReportRow>((row) => ({
			employeeId: row.employeeId,
			employeeName: row.employeeName,
			employeeNo: row.employeeNo,
			departmentName: row.departmentName,
			leaveType: row.leaveType,
			leaveTypeLabel: formatText(row.leaveType),
			entitledDays: row.entitledDays,
			carriedForwardDays: row.carriedForwardDays,
			adjustmentDays: row.adjustmentDays,
			takenDays: row.takenDays,
			availableBalance: computeLeaveAvailableBalance(row),
			carryForwardExpiresAt: normalizeDateValue(row.carryForwardExpiresAt),
		}))
		.sort((left, right) => {
			const departmentCompare = (left.departmentName ?? "").localeCompare(right.departmentName ?? "");
			if (departmentCompare !== 0) return departmentCompare;

			const employeeCompare = left.employeeName.localeCompare(right.employeeName);
			if (employeeCompare !== 0) return employeeCompare;

			return left.leaveTypeLabel.localeCompare(right.leaveTypeLabel);
		});

	const employeeSummaries = Array.from(
		detailRows.reduce(
			(acc, row) => {
				const existing =
					acc.get(row.employeeId) ??
					({
						employeeId: row.employeeId,
						employeeName: row.employeeName,
						employeeNo: row.employeeNo,
						departmentName: row.departmentName,
						totalEntitled: 0,
						totalTaken: 0,
						totalAvailable: 0,
					} satisfies LeaveUtilisationEmployeeSummary);

				existing.totalEntitled += row.entitledDays;
				existing.totalTaken += row.takenDays;
				existing.totalAvailable += row.availableBalance;
				acc.set(row.employeeId, existing);
				return acc;
			},
			new Map<string, LeaveUtilisationEmployeeSummary>()
		).values()
	);

	const totals = detailRows.reduce<LeaveUtilisationTotals>(
		(acc, row) => {
			acc.totalEntitled += row.entitledDays;
			acc.totalTaken += row.takenDays;
			acc.totalAvailable += row.availableBalance;
			return acc;
		},
		{
			totalEntitled: 0,
			totalTaken: 0,
			totalAvailable: 0,
		}
	);

	return {
		leaveYear,
		rows: detailRows,
		employeeSummaries,
		totals,
	};
}

function normalizeDateValue(value: Date | string | null) {
	if (!value) return null;
	return value instanceof Date ? value.toISOString() : value;
}
