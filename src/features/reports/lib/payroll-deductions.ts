export const VOLUNTARY_DEDUCTION_LABELS: Record<string, string> = {
	company_loan: "Company Loans",
	salary_advance: "Salary Advances",
	sacco: "SACCO",
	union_dues: "Union Dues",
	court_order: "Court Orders",
	insurance: "Insurance",
	welfare: "Welfare",
	other: "Other",
};

export const VOLUNTARY_DEDUCTION_ORDER = [
	"company_loan",
	"salary_advance",
	"sacco",
	"union_dues",
	"court_order",
	"insurance",
	"welfare",
	"other",
] as const;

export type VoluntaryDeductionType = (typeof VOLUNTARY_DEDUCTION_ORDER)[number];

export type DeductionsPeriod = {
	id: string;
	name: string;
	periodMonth: number;
	periodYear: number;
	status: string;
};

export type StatutoryDeductionRow = {
	employeeName: string;
	employeeNo: string;
	category: string;
	amount: number;
};

export type StatutoryTotals = {
	paye: number;
	nssfEmployee: number;
	shifEmployee: number;
	ahlEmployee: number;
	helb: number;
	subtotal: number;
};

export type VoluntaryDeductionRow = {
	employeeName: string;
	employeeNo: string;
	deductionType: VoluntaryDeductionType;
	description: string;
	amount: number;
};

export type VoluntaryGroup = {
	deductionType: VoluntaryDeductionType;
	label: string;
	rows: VoluntaryDeductionRow[];
	subtotal: number;
};

export type DeductionsReport = {
	period: DeductionsPeriod;
	statutory: { rows: StatutoryDeductionRow[]; totals: StatutoryTotals };
	voluntary: { groups: VoluntaryGroup[]; total: number };
	grandTotal: number;
};

export type SlipForDeductions = {
	employeeName: string;
	employeeNo: string;
	netPaye: number;
	nssfEmployee: number;
	shifEmployee: number;
	ahlEmployee: number;
	helbDeduction: number;
};

export type VoluntaryDeductionSource = {
	employeeName: string;
	employeeNo: string;
	deductionType: VoluntaryDeductionType;
	description: string;
	amount: number;
};

import { isReportablePeriodStatus, r2 } from "./report-utils";

export function isValidDeductionsReportStatus(status: string): boolean {
	return isReportablePeriodStatus(status);
}

export function buildDeductionsReport(params: {
	period: DeductionsPeriod;
	slips: SlipForDeductions[];
	voluntaryDeductions: VoluntaryDeductionSource[];
}): DeductionsReport {
	const { period, slips, voluntaryDeductions } = params;

	// Build statutory rows (one row per non-zero deduction per employee)
	const statutoryRows: StatutoryDeductionRow[] = [];
	for (const slip of slips) {
		if (slip.netPaye > 0) {
			statutoryRows.push({ employeeName: slip.employeeName, employeeNo: slip.employeeNo, category: "PAYE", amount: slip.netPaye });
		}
		if (slip.nssfEmployee > 0) {
			statutoryRows.push({ employeeName: slip.employeeName, employeeNo: slip.employeeNo, category: "NSSF Employee", amount: slip.nssfEmployee });
		}
		if (slip.shifEmployee > 0) {
			statutoryRows.push({ employeeName: slip.employeeName, employeeNo: slip.employeeNo, category: "SHIF", amount: slip.shifEmployee });
		}
		if (slip.ahlEmployee > 0) {
			statutoryRows.push({ employeeName: slip.employeeName, employeeNo: slip.employeeNo, category: "AHL Employee", amount: slip.ahlEmployee });
		}
		if (slip.helbDeduction > 0) {
			statutoryRows.push({ employeeName: slip.employeeName, employeeNo: slip.employeeNo, category: "HELB", amount: slip.helbDeduction });
		}
	}

	const statutoryTotals = slips.reduce<StatutoryTotals>(
		(acc, slip) => ({
			paye: r2(acc.paye + slip.netPaye),
			nssfEmployee: r2(acc.nssfEmployee + slip.nssfEmployee),
			shifEmployee: r2(acc.shifEmployee + slip.shifEmployee),
			ahlEmployee: r2(acc.ahlEmployee + slip.ahlEmployee),
			helb: r2(acc.helb + slip.helbDeduction),
			subtotal: r2(acc.subtotal + slip.netPaye + slip.nssfEmployee + slip.shifEmployee + slip.ahlEmployee + slip.helbDeduction),
		}),
		{ paye: 0, nssfEmployee: 0, shifEmployee: 0, ahlEmployee: 0, helb: 0, subtotal: 0 }
	);

	// Build voluntary groups in canonical order
	const groupMap = new Map<VoluntaryDeductionType, VoluntaryDeductionRow[]>();
	for (const d of voluntaryDeductions) {
		const existing = groupMap.get(d.deductionType) ?? [];
		existing.push({
			employeeName: d.employeeName,
			employeeNo: d.employeeNo,
			deductionType: d.deductionType,
			description: d.description,
			amount: d.amount,
		});
		groupMap.set(d.deductionType, existing);
	}

	const groups: VoluntaryGroup[] = VOLUNTARY_DEDUCTION_ORDER.filter((type) =>
		groupMap.has(type)
	).map((type) => {
		const rows = groupMap.get(type) ?? [];
		return {
			deductionType: type,
			label: VOLUNTARY_DEDUCTION_LABELS[type] ?? type,
			rows,
			subtotal: r2(rows.reduce((acc, r) => acc + r.amount, 0)),
		};
	});

	const voluntaryTotal = r2(groups.reduce((acc, g) => acc + g.subtotal, 0));
	const grandTotal = r2(statutoryTotals.subtotal + voluntaryTotal);

	return {
		period,
		statutory: { rows: statutoryRows, totals: statutoryTotals },
		voluntary: { groups, total: voluntaryTotal },
		grandTotal,
	};
}
