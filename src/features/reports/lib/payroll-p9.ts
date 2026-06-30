import { computePayeRowValues, PAYE_E3_FIXED } from "./paye-row";

export const PAYROLL_P9_MONTHS = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
] as const;

// E3: statutory fixed monthly cap for Defined Contribution Retirement Scheme
export const P9_E3_FIXED = PAYE_E3_FIXED; // 30,000

export type PayrollP9EmployeeSummary = {
	employeeNo: string;
	firstName: string;
	lastName: string;
	kraPin: string | null;
	hireDate: string | null;
	terminationDate: string | null;
};

export type PayrollP9SourceMonth = {
	periodMonth: number;
	basicSalary: number | null; // Column A
	grossPay: number | null; // Column D
	nssfEmployee: number | null; // contributes to E2
	pensionEmployeeDeduction: number | null; // contributes to E2
	ahlEmployee: number | null; // Column F
	shifEmployee: number | null; // Column G
	postRetirementAllowableDeduction: number | null; // Column H
	mortgageAllowableDeduction: number | null; // Column I
	grossTax: number | null; // Column L
	personalRelief: number | null; // Column M
	insuranceRelief: number | null; // Column N
	netPaye: number | null; // Column O
};

export type PayrollP9Row = {
	month: (typeof PAYROLL_P9_MONTHS)[number];
	monthNumber: number;
	basicSalary: number | null; // A
	benefitsNonCash: null; // B — not tracked; always null
	valueOfQuarters: null; // C — not tracked; always null
	totalGrossPay: number | null; // D
	e1ThirtyPctBasic: number | null; // E1 = 0.30 × A
	e2ActualPension: number | null; // E2 = nssfEmployee + pensionEmployeeDeduction
	e3Fixed: number | null; // E3 = 30,000 p.m.
	// E (effective) = min(E1, E2, E3) — used in computing J; not a separate display column per the official form
	ahlEmployee: number | null; // F
	shifEmployee: number | null; // G
	prmf: number | null; // H
	ownerOccupiedInterest: number | null; // I
	totalDeductions: number | null; // J = min(E1,E2,E3) + F + G + H + I
	chargeablePay: number | null; // K = D − J
	taxCharged: number | null; // L
	personalRelief: number | null; // M
	insuranceRelief: number | null; // N
	payeTax: number | null; // O = L − M − N (stored as netPaye)
};

export type PayrollP9Totals = {
	basicSalary: number;
	benefitsNonCash: number;
	valueOfQuarters: number;
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

export type PayrollP9Report = {
	employee: {
		name: string;
		firstName: string;
		lastName: string;
		kraPin: string | null;
		employeeNo: string;
		hireDate: string | null;
		terminationDate: string | null;
	};
	taxYear: number;
	rows: PayrollP9Row[];
	totals: PayrollP9Totals;
	monthsWithClosedPeriods: number;
	monthsWithPayrollActivity: number;
};

function createBlankRow(monthNumber: number): PayrollP9Row {
	return {
		month: PAYROLL_P9_MONTHS[monthNumber - 1],
		monthNumber,
		basicSalary: null,
		benefitsNonCash: null,
		valueOfQuarters: null,
		totalGrossPay: null,
		e1ThirtyPctBasic: null,
		e2ActualPension: null,
		e3Fixed: null,
		ahlEmployee: null,
		shifEmployee: null,
		prmf: null,
		ownerOccupiedInterest: null,
		totalDeductions: null,
		chargeablePay: null,
		taxCharged: null,
		personalRelief: null,
		insuranceRelief: null,
		payeTax: null,
	};
}

function isPopulatedRow(row: PayrollP9Row): boolean {
	return row.totalGrossPay !== null;
}

function buildRow(monthNumber: number, source: PayrollP9SourceMonth): PayrollP9Row {
	const computed = computePayeRowValues(source);
	if (computed.basicSalary === null) {
		return createBlankRow(monthNumber);
	}
	return {
		month: PAYROLL_P9_MONTHS[monthNumber - 1],
		monthNumber,
		benefitsNonCash: null,
		valueOfQuarters: null,
		...computed,
	};
}

export function buildPayrollP9Report(params: {
	employee: PayrollP9EmployeeSummary;
	taxYear: number;
	closedMonths: PayrollP9SourceMonth[];
}): PayrollP9Report {
	const monthMap = new Map(params.closedMonths.map((m) => [m.periodMonth, m]));

	const rows = Array.from({ length: 12 }, (_, index) => {
		const monthNumber = index + 1;
		const source = monthMap.get(monthNumber);

		if (!source || source.grossPay === null) {
			return createBlankRow(monthNumber);
		}

		return buildRow(monthNumber, source);
	});

	const totals = rows.reduce<PayrollP9Totals>(
		(acc, row) => {
			if (!isPopulatedRow(row)) return acc;

			acc.basicSalary += row.basicSalary ?? 0;
			acc.benefitsNonCash += row.benefitsNonCash ?? 0;
			acc.valueOfQuarters += row.valueOfQuarters ?? 0;
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
			benefitsNonCash: 0,
			valueOfQuarters: 0,
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
		employee: {
			name: `${params.employee.firstName} ${params.employee.lastName}`.trim(),
			firstName: params.employee.firstName,
			lastName: params.employee.lastName,
			kraPin: params.employee.kraPin,
			employeeNo: params.employee.employeeNo,
			hireDate: params.employee.hireDate,
			terminationDate: params.employee.terminationDate,
		},
		taxYear: params.taxYear,
		rows,
		totals,
		monthsWithClosedPeriods: new Set(params.closedMonths.map((m) => m.periodMonth)).size,
		monthsWithPayrollActivity: rows.filter(isPopulatedRow).length,
	};
}
