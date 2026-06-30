import { PAYE_PENSION_ALLOWABLE_MAX } from "@/features/payroll/lib/payroll-constants";

export const PAYE_E3_FIXED = PAYE_PENSION_ALLOWABLE_MAX; // 30,000 p.m.

function r2(value: number): number {
	return Math.round(value * 100) / 100;
}

export type PayeSlipSource = {
	basicSalary: number | null;
	grossPay: number | null;
	nssfEmployee: number | null;
	pensionEmployeeDeduction: number | null;
	ahlEmployee: number | null;
	shifEmployee: number | null;
	postRetirementAllowableDeduction: number | null;
	mortgageAllowableDeduction: number | null;
	grossTax: number | null;
	personalRelief: number | null;
	insuranceRelief: number | null;
	netPaye: number | null;
};

export type PayeComputedRow = {
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

export function computePayeRowValues(source: PayeSlipSource): PayeComputedRow {
	if (source.grossPay === null || source.basicSalary === null) {
		return {
			basicSalary: null,
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

	const basicSalary = source.basicSalary;
	const totalGrossPay = source.grossPay;

	const e1ThirtyPctBasic = r2(basicSalary * 0.3);
	const e2ActualPension = r2((source.nssfEmployee ?? 0) + (source.pensionEmployeeDeduction ?? 0));
	const e3Fixed = PAYE_E3_FIXED;
	const eEffective = Math.min(e1ThirtyPctBasic, e2ActualPension, e3Fixed);

	const ahlEmployee = source.ahlEmployee ?? 0;
	const shifEmployee = source.shifEmployee ?? 0;
	const prmf = source.postRetirementAllowableDeduction ?? 0;
	const ownerOccupiedInterest = source.mortgageAllowableDeduction ?? 0;

	const totalDeductions = r2(eEffective + ahlEmployee + shifEmployee + prmf + ownerOccupiedInterest);
	const chargeablePay = r2(Math.max(totalGrossPay - totalDeductions, 0));

	return {
		basicSalary,
		totalGrossPay,
		e1ThirtyPctBasic,
		e2ActualPension,
		e3Fixed,
		ahlEmployee,
		shifEmployee,
		prmf,
		ownerOccupiedInterest,
		totalDeductions,
		chargeablePay,
		taxCharged: source.grossTax,
		personalRelief: source.personalRelief,
		insuranceRelief: source.insuranceRelief,
		payeTax: source.netPaye,
	};
}
