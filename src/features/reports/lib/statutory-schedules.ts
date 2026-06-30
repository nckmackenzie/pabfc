import { isReportablePeriodStatus, r2 } from "./report-utils";

export type StatutoryPeriod = {
	id: string;
	name: string;
	periodMonth: number;
	periodYear: number;
	payDate: string;
	status: string;
};

export type NssfRow = {
	employeeName: string;
	employeeNo: string;
	nssfNo: string | null;
	nssfEmployee: number;
	nssfEmployer: number;
	total: number;
};

export type NssfTotals = {
	nssfEmployee: number;
	nssfEmployer: number;
	total: number;
};

export type ShifRow = {
	employeeName: string;
	employeeNo: string;
	shifNo: string | null;
	shifEmployee: number;
};

export type ShifTotals = {
	shifEmployee: number;
};

export type AhlRow = {
	employeeName: string;
	employeeNo: string;
	kraPin: string | null;
	ahlEmployee: number;
	ahlEmployer: number;
	total: number;
};

export type AhlTotals = {
	ahlEmployee: number;
	ahlEmployer: number;
	total: number;
};

export type NitaSummary = {
	employeeCount: number;
	totalLevy: number;
};

export type StatutoryScheduleSlip = {
	employeeNo: string;
	employeeName: string;
	nssfNo: string | null;
	shifNo: string | null;
	kraPin: string | null;
	nssfEmployee: number;
	nssfEmployer: number;
	shifEmployee: number;
	ahlEmployee: number;
	ahlEmployer: number;
	nitaLevy: number;
};

export type StatutorySchedulesReport = {
	period: StatutoryPeriod;
	nssf: { rows: NssfRow[]; totals: NssfTotals };
	shif: { rows: ShifRow[]; totals: ShifTotals };
	ahl: { rows: AhlRow[]; totals: AhlTotals };
	nita: NitaSummary;
};

export function isValidStatutoryScheduleStatus(status: string): boolean {
	return isReportablePeriodStatus(status);
}

export function buildStatutorySchedulesReport(params: {
	period: StatutoryPeriod;
	slips: StatutoryScheduleSlip[];
}): StatutorySchedulesReport {
	const { period, slips } = params;

	const nssfRows: NssfRow[] = slips.map((s) => ({
		employeeName: s.employeeName,
		employeeNo: s.employeeNo,
		nssfNo: s.nssfNo,
		nssfEmployee: s.nssfEmployee,
		nssfEmployer: s.nssfEmployer,
		total: r2(s.nssfEmployee + s.nssfEmployer),
	}));

	const nssfTotals = nssfRows.reduce<NssfTotals>(
		(acc, r) => ({
			nssfEmployee: r2(acc.nssfEmployee + r.nssfEmployee),
			nssfEmployer: r2(acc.nssfEmployer + r.nssfEmployer),
			total: r2(acc.total + r.total),
		}),
		{ nssfEmployee: 0, nssfEmployer: 0, total: 0 }
	);

	const shifRows: ShifRow[] = slips.map((s) => ({
		employeeName: s.employeeName,
		employeeNo: s.employeeNo,
		shifNo: s.shifNo,
		shifEmployee: s.shifEmployee,
	}));

	const shifTotals = shifRows.reduce<ShifTotals>(
		(acc, r) => ({ shifEmployee: r2(acc.shifEmployee + r.shifEmployee) }),
		{ shifEmployee: 0 }
	);

	const ahlRows: AhlRow[] = slips.map((s) => ({
		employeeName: s.employeeName,
		employeeNo: s.employeeNo,
		kraPin: s.kraPin,
		ahlEmployee: s.ahlEmployee,
		ahlEmployer: s.ahlEmployer,
		total: r2(s.ahlEmployee + s.ahlEmployer),
	}));

	const ahlTotals = ahlRows.reduce<AhlTotals>(
		(acc, r) => ({
			ahlEmployee: r2(acc.ahlEmployee + r.ahlEmployee),
			ahlEmployer: r2(acc.ahlEmployer + r.ahlEmployer),
			total: r2(acc.total + r.total),
		}),
		{ ahlEmployee: 0, ahlEmployer: 0, total: 0 }
	);

	const nitaLevy = r2(slips.reduce((acc, s) => acc + s.nitaLevy, 0));

	return {
		period,
		nssf: { rows: nssfRows, totals: nssfTotals },
		shif: { rows: shifRows, totals: shifTotals },
		ahl: { rows: ahlRows, totals: ahlTotals },
		nita: { employeeCount: slips.length, totalLevy: nitaLevy },
	};
}
