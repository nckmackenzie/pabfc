import type { ResolvedStatutoryRates } from "@/features/payroll/lib/payroll-rate-resolver";
import { roundDecimal, toBig } from "@/lib/helpers";

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
	const parsedGrossPay = roundDecimal(grossPay);
	const tier1Pensionable = Math.min(parsedGrossPay, rates.nssfTier1UpperLimit);
	const tier2Pensionable = Math.min(
		Math.max(parsedGrossPay - rates.nssfTier1UpperLimit, 0),
		Math.max(rates.nssfTier2UpperLimit - rates.nssfTier1UpperLimit, 0)
	);
	const tier1Employee = roundDecimal(tier1Pensionable * rates.nssfContributionRate);
	const tier1Employer = roundDecimal(tier1Pensionable * rates.nssfContributionRate);
	const tier2Employee = roundDecimal(tier2Pensionable * rates.nssfContributionRate);
	const tier2Employer = roundDecimal(tier2Pensionable * rates.nssfContributionRate);
	const employeeContribution = roundDecimal(
		Math.min(tier1Employee + tier2Employee, rates.nssfMaxEmployee)
	);
	const employerContribution = roundDecimal(
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
	const parsedGrossPay = roundDecimal(grossPay);
	const contribution = roundDecimal(Math.max(parsedGrossPay * rates.shifRate, rates.shifMinimum));

	return {
		employeeContribution: contribution,
		employerContribution: 0,
	};
}

export function computeAHL(grossPay: NumericLike, rates: ResolvedStatutoryRates) {
	const parsedGrossPay = roundDecimal(grossPay);

	return {
		employeeContribution: roundDecimal(parsedGrossPay * rates.ahlEmployeeRate),
		employerContribution: roundDecimal(parsedGrossPay * rates.ahlEmployerRate),
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
	const pensionAllowable = roundDecimal(
		Math.min(roundDecimal(allowableDeductions.pensionContribution), rates.pensionAllowableMax)
	);
	const mortgageAllowable = roundDecimal(
		Math.min(roundDecimal(allowableDeductions.mortgageInterest), rates.mortgageAllowableMax)
	);
	const postRetirementAllowable = roundDecimal(
		Math.min(
			roundDecimal(allowableDeductions.postRetirementMedical),
			rates.postRetirementMedicalMax
		)
	);
	const mealExempt = roundDecimal(
		Math.min(roundDecimal(allowableDeductions.mealAllowanceActual), rates.mealAllowanceExempt)
	);
	const nonCashExempt = roundDecimal(
		Math.min(roundDecimal(allowableDeductions.nonCashBenefitActual), rates.nonCashBenefitExempt)
	);

	const taxableIncome = roundDecimal(
		Math.max(
			roundDecimal(grossPay) -
				roundDecimal(nssfEmployee) -
				roundDecimal(shifEmployee) -
				roundDecimal(ahlEmployee) -
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
	const parsedTaxableIncome = roundDecimal(taxableIncome);
	const bandBreakdown: PayeBandBreakdown[] = [];

	for (const band of rates.payeBands) {
		const floorExclusive = band.lowerBound <= 0 ? 0 : band.lowerBound - 1;
		const bandCap = band.upperBound ?? parsedTaxableIncome;
		const taxableAmount = roundDecimal(
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
			taxAmount: roundDecimal(taxableAmount * band.rate),
		});
	}

	const grossTax = roundDecimal(bandBreakdown.reduce((total, band) => total + band.taxAmount, 0));

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
		reliefAmount: roundDecimal(
			Math.min(
				roundDecimal(insurancePremiums) * rates.insuranceReliefRate,
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
		netPAYE: roundDecimal(
			Math.max(
				roundDecimal(grossTax) - roundDecimal(personalRelief) - roundDecimal(insuranceRelief),
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
	const normalizedGrossPay = roundDecimal(grossPay);
	const pensionEmployer = roundDecimal(salaryStructureComponents.pensionEmployerContribution);

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
	const nitaLevy = roundDecimal(rates.nitaLevyPerEmployee);
	const totalStatutoryDeductions = roundDecimal(
		toBig(nssf.employeeContribution)
			.plus(shif.employeeContribution)
			.plus(ahl.employeeContribution)
			.plus(netPAYE)
	);
	const totalEmployerCost = roundDecimal(
		toBig(normalizedGrossPay)
			.plus(nssf.employerContribution)
			.plus(shif.employerContribution)
			.plus(ahl.employerContribution)
			.plus(nitaLevy)
			.plus(pensionEmployer)
	);
	const netPayBeforeVoluntary = roundDecimal(
		toBig(normalizedGrossPay).minus(totalStatutoryDeductions)
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
		personalRelief: roundDecimal(rates.personalRelief),
		insuranceRelief: reliefAmount,
		netPAYE,
		totalEmployerCost,
		totalStatutoryDeductions,
		netPayBeforeVoluntary,
	};
}
