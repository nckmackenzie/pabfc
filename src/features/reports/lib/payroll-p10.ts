import { computePayeRowValues, type PayeSlipSource } from "./paye-row";
import { isReportablePeriodStatus } from "./report-utils";

const EMPLOYER_NAME = "Prime Age Beauty & Fitness Center";
const EMPLOYER_PIN = "P051457619H";

export type P10EmployeeSource = PayeSlipSource & {
	employeeNo: string;
	employeeName: string;
	kraPin: string | null;
};

export type P10EmployeeRow = {
	employeeNo: string;
	employeeName: string;
	kraPin: string | null;
	basicSalary: number | null;
	totalGrossPay: number | null;
	e1ThirtyPctBasic: number | null;
	e2ActualPension: number | null;
	e3Fixed: number | null;
	ahlEmployee: number | null;
	shifEmployee: number | null;
	prmf: number | null;
	ownerOccupiedInterest: number | null;
	totalDeductions: number | null;
	chargeablePay: number | null;
	taxCharged: number | null;
	personalRelief: number | null;
	insuranceRelief: number | null;
	payeTax: number | null;
};

export type P10Totals = {
	basicSalary: number;
	totalGrossPay: number;
	e1ThirtyPctBasic: number;
	e2ActualPension: number;
	e3Fixed: number;
	ahlEmployee: number;
	shifEmployee: number;
	prmf: number;
	ownerOccupiedInterest: number;
	totalDeductions: number;
	chargeablePay: number;
	taxCharged: number;
	personalRelief: number;
	insuranceRelief: number;
	payeTax: number;
};

export type P10Period = {
	id: string;
	name: string;
	periodMonth: number;
	periodYear: number;
	payDate: string;
	status: string;
};

export type P10Report = {
	period: P10Period;
	employer: { name: string; kraPin: string };
	rows: P10EmployeeRow[];
	totals: P10Totals;
};

export function isValidP10Status(status: string): boolean {
	return isReportablePeriodStatus(status);
}

export function buildPayrollP10Report(params: {
	period: P10Period;
	slips: P10EmployeeSource[];
}): P10Report {
	const rows: P10EmployeeRow[] = params.slips.map((slip) => ({
		employeeNo: slip.employeeNo,
		employeeName: slip.employeeName,
		kraPin: slip.kraPin,
		...computePayeRowValues(slip),
	}));

	const totals = rows.reduce<P10Totals>(
		(acc, row) => {
			if (row.totalGrossPay === null) return acc;
			acc.basicSalary += row.basicSalary ?? 0;
			acc.totalGrossPay += row.totalGrossPay ?? 0;
			acc.e1ThirtyPctBasic += row.e1ThirtyPctBasic ?? 0;
			acc.e2ActualPension += row.e2ActualPension ?? 0;
			acc.e3Fixed += row.e3Fixed ?? 0;
			acc.ahlEmployee += row.ahlEmployee ?? 0;
			acc.shifEmployee += row.shifEmployee ?? 0;
			acc.prmf += row.prmf ?? 0;
			acc.ownerOccupiedInterest += row.ownerOccupiedInterest ?? 0;
			acc.totalDeductions += row.totalDeductions ?? 0;
			acc.chargeablePay += row.chargeablePay ?? 0;
			acc.taxCharged += row.taxCharged ?? 0;
			acc.personalRelief += row.personalRelief ?? 0;
			acc.insuranceRelief += row.insuranceRelief ?? 0;
			acc.payeTax += row.payeTax ?? 0;
			return acc;
		},
		{
			basicSalary: 0,
			totalGrossPay: 0,
			e1ThirtyPctBasic: 0,
			e2ActualPension: 0,
			e3Fixed: 0,
			ahlEmployee: 0,
			shifEmployee: 0,
			prmf: 0,
			ownerOccupiedInterest: 0,
			totalDeductions: 0,
			chargeablePay: 0,
			taxCharged: 0,
			personalRelief: 0,
			insuranceRelief: 0,
			payeTax: 0,
		}
	);

	return {
		period: params.period,
		employer: { name: EMPLOYER_NAME, kraPin: EMPLOYER_PIN },
		rows,
		totals,
	};
}
