import { roundPayrollAmount, toPayrollBig } from "@/features/payroll/lib/helpers";
import type { ResolvedStatutoryRates } from "@/features/payroll/lib/payroll-rate-resolver";

type NumericLike = number | string | null | undefined;

export type TaxableIncomeInputs = {
	pensionContribution: NumericLike;
	mortgageInterest: NumericLike;
	postRetirementMedical: NumericLike;
	mealAllowanceActual: NumericLike;
	nonCashBenefitActual: NumericLike;
};

export type PayrollPreviewSalaryStructureComponents = {
	pensionEmployeeContribution?: NumericLike;
	pensionEmployerContribution?: NumericLike;
	mortgageInterestMonthly?: NumericLike;
	postRetirementMedicalMonthly?: NumericLike;
	insurancePremiumsMonthly?: NumericLike;
	mealAllowance?: NumericLike;
	airtimeAllowance?: NumericLike;
};

export type TaxableIncomeBreakdown = {
	pensionAllowable: number;
	mortgageAllowable: number;
	postRetirementAllowable: number;
	mealExempt: number;
	nonCashExempt: number;
};

export type PayeBandBreakdown = {
	lowerBound: number;
	upperBound: number | null;
	rate: number;
	taxableAmount: number;
	taxAmount: number;
};

export function computeNSSF(grossPay: NumericLike, rates: ResolvedStatutoryRates) {
	const parsedGrossPay = roundPayrollAmount(grossPay);
	const tier1Pensionable = Math.min(parsedGrossPay, rates.nssfTier1UpperLimit);
	const tier2Pensionable = Math.min(
		Math.max(parsedGrossPay - rates.nssfTier1UpperLimit, 0),
		Math.max(rates.nssfTier2UpperLimit - rates.nssfTier1UpperLimit, 0)
	);
	const tier1Employee = roundPayrollAmount(tier1Pensionable * rates.nssfContributionRate);
	const tier1Employer = roundPayrollAmount(tier1Pensionable * rates.nssfContributionRate);
	const tier2Employee = roundPayrollAmount(tier2Pensionable * rates.nssfContributionRate);
	const tier2Employer = roundPayrollAmount(tier2Pensionable * rates.nssfContributionRate);
	const employeeContribution = roundPayrollAmount(
		Math.min(tier1Employee + tier2Employee, rates.nssfMaxEmployee)
	);
	const employerContribution = roundPayrollAmount(
		Math.min(tier1Employer + tier2Employer, rates.nssfMaxEmployer)
	);

	return {
		employeeContribution,
		employerContribution,
		tier1Employee,
		tier1Employer,
		tier2Employee,
		tier2Employer,
	};
}

export function computeSHIF(grossPay: NumericLike, rates: ResolvedStatutoryRates) {
	const parsedGrossPay = roundPayrollAmount(grossPay);
	const contribution = roundPayrollAmount(
		Math.max(parsedGrossPay * rates.shifRate, rates.shifMinimum)
	);

	return {
		employeeContribution: contribution,
		employerContribution: 0,
	};
}

export function computeAHL(grossPay: NumericLike, rates: ResolvedStatutoryRates) {
	const parsedGrossPay = roundPayrollAmount(grossPay);

	return {
		employeeContribution: roundPayrollAmount(parsedGrossPay * rates.ahlEmployeeRate),
		employerContribution: roundPayrollAmount(parsedGrossPay * rates.ahlEmployerRate),
	};
}

export function computeTaxableIncome(
	grossPay: NumericLike,
	nssfEmployee: NumericLike,
	shifEmployee: NumericLike,
	ahlEmployee: NumericLike,
	allowableDeductions: TaxableIncomeInputs,
	rates: ResolvedStatutoryRates
) {
	const pensionAllowable = roundPayrollAmount(
		Math.min(roundPayrollAmount(allowableDeductions.pensionContribution), rates.pensionAllowableMax)
	);
	const mortgageAllowable = roundPayrollAmount(
		Math.min(roundPayrollAmount(allowableDeductions.mortgageInterest), rates.mortgageAllowableMax)
	);
	const postRetirementAllowable = roundPayrollAmount(
		Math.min(
			roundPayrollAmount(allowableDeductions.postRetirementMedical),
			rates.postRetirementMedicalMax
		)
	);
	const mealExempt = roundPayrollAmount(
		Math.min(roundPayrollAmount(allowableDeductions.mealAllowanceActual), rates.mealAllowanceExempt)
	);
	const nonCashExempt = roundPayrollAmount(
		Math.min(
			roundPayrollAmount(allowableDeductions.nonCashBenefitActual),
			rates.nonCashBenefitExempt
		)
	);

	const taxableIncome = roundPayrollAmount(
		Math.max(
			roundPayrollAmount(grossPay) -
				roundPayrollAmount(nssfEmployee) -
				roundPayrollAmount(shifEmployee) -
				roundPayrollAmount(ahlEmployee) -
				pensionAllowable -
				mortgageAllowable -
				postRetirementAllowable -
				mealExempt -
				nonCashExempt,
			0
		)
	);

	return {
		taxableIncome,
		deductionBreakdown: {
			pensionAllowable,
			mortgageAllowable,
			postRetirementAllowable,
			mealExempt,
			nonCashExempt,
		} satisfies TaxableIncomeBreakdown,
	};
}

export function computeGrossTax(taxableIncome: NumericLike, rates: ResolvedStatutoryRates) {
	const parsedTaxableIncome = roundPayrollAmount(taxableIncome);
	const bandBreakdown: PayeBandBreakdown[] = [];

	for (const band of rates.payeBands) {
		const floorExclusive = band.lowerBound <= 0 ? 0 : band.lowerBound - 1;
		const bandCap = band.upperBound ?? parsedTaxableIncome;
		const taxableAmount = roundPayrollAmount(
			Math.max(Math.min(parsedTaxableIncome, bandCap) - floorExclusive, 0)
		);

		if (taxableAmount <= 0) {
			continue;
		}

		bandBreakdown.push({
			lowerBound: band.lowerBound,
			upperBound: band.upperBound,
			rate: band.rate,
			taxableAmount,
			taxAmount: roundPayrollAmount(taxableAmount * band.rate),
		});
	}

	const grossTax = roundPayrollAmount(
		bandBreakdown.reduce((total, band) => total + band.taxAmount, 0)
	);

	return {
		grossTax,
		bandBreakdown,
	};
}

export function computeInsuranceRelief(
	insurancePremiums: NumericLike,
	rates: ResolvedStatutoryRates
) {
	return {
		reliefAmount: roundPayrollAmount(
			Math.min(
				roundPayrollAmount(insurancePremiums) * rates.insuranceReliefRate,
				rates.insuranceReliefMax
			)
		),
	};
}

export function computeNetPAYE(
	grossTax: NumericLike,
	personalRelief: NumericLike,
	insuranceRelief: NumericLike
) {
	return {
		netPAYE: roundPayrollAmount(
			Math.max(
				roundPayrollAmount(grossTax) -
					roundPayrollAmount(personalRelief) -
					roundPayrollAmount(insuranceRelief),
				0
			)
		),
	};
}

export function computeFullPayrollDeductions(
	grossPay: NumericLike,
	salaryStructureComponents: PayrollPreviewSalaryStructureComponents,
	rates: ResolvedStatutoryRates
) {
	const normalizedGrossPay = roundPayrollAmount(grossPay);
	const pensionEmployer = roundPayrollAmount(salaryStructureComponents.pensionEmployerContribution);

	const nssf = computeNSSF(normalizedGrossPay, rates);
	const shif = computeSHIF(normalizedGrossPay, rates);
	const ahl = computeAHL(normalizedGrossPay, rates);
	const { taxableIncome, deductionBreakdown } = computeTaxableIncome(
		normalizedGrossPay,
		nssf.employeeContribution,
		shif.employeeContribution,
		ahl.employeeContribution,
		{
			pensionContribution: salaryStructureComponents.pensionEmployeeContribution,
			mortgageInterest: salaryStructureComponents.mortgageInterestMonthly,
			postRetirementMedical: salaryStructureComponents.postRetirementMedicalMonthly,
			mealAllowanceActual: salaryStructureComponents.mealAllowance,
			nonCashBenefitActual: salaryStructureComponents.airtimeAllowance,
		},
		rates
	);
	const { grossTax, bandBreakdown } = computeGrossTax(taxableIncome, rates);
	const { reliefAmount } = computeInsuranceRelief(
		salaryStructureComponents.insurancePremiumsMonthly,
		rates
	);
	const { netPAYE } = computeNetPAYE(grossTax, rates.personalRelief, reliefAmount);
	const nitaLevy = roundPayrollAmount(rates.nitaLevyPerEmployee);
	const totalStatutoryDeductions = roundPayrollAmount(
		toPayrollBig(nssf.employeeContribution)
			.plus(shif.employeeContribution)
			.plus(ahl.employeeContribution)
			.plus(netPAYE)
	);
	const totalEmployerCost = roundPayrollAmount(
		toPayrollBig(normalizedGrossPay)
			.plus(nssf.employerContribution)
			.plus(shif.employerContribution)
			.plus(ahl.employerContribution)
			.plus(nitaLevy)
			.plus(pensionEmployer)
	);
	const netPayBeforeVoluntary = roundPayrollAmount(
		toPayrollBig(normalizedGrossPay).minus(totalStatutoryDeductions)
	);

	return {
		grossPay: normalizedGrossPay,
		nssfEmployee: nssf.employeeContribution,
		nssfEmployer: nssf.employerContribution,
		nssfTier1Employee: nssf.tier1Employee,
		nssfTier1Employer: nssf.tier1Employer,
		nssfTier2Employee: nssf.tier2Employee,
		nssfTier2Employer: nssf.tier2Employer,
		shifEmployee: shif.employeeContribution,
		shifEmployer: shif.employerContribution,
		ahlEmployee: ahl.employeeContribution,
		ahlEmployer: ahl.employerContribution,
		nitaLevy,
		taxableIncome,
		deductionBreakdown,
		grossTax,
		bandBreakdown,
		personalRelief: roundPayrollAmount(rates.personalRelief),
		insuranceRelief: reliefAmount,
		netPAYE,
		totalEmployerCost,
		totalStatutoryDeductions,
		netPayBeforeVoluntary,
	};
}
