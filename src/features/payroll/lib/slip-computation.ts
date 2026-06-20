import type { PayrollDeductionType } from "@/drizzle/schema";
import {
	roundPayrollAmount,
} from "@/features/payroll/lib/helpers";
import {
	computeAHL,
	computeGrossTax,
	computeInsuranceRelief,
	computeNetPAYE,
	computeNSSF,
	computeSHIF,
	computeTaxableIncome,
} from "@/features/payroll/lib/paye-engine";
import type { ResolvedStatutoryRates } from "@/features/payroll/lib/payroll-rate-resolver";
import { applyProration, type ProrationReason } from "@/features/payroll/lib/proration";
import { failure, success, type Result } from "@/lib/result";

type OtherDeductionType = Exclude<
	PayrollDeductionType,
	"company_loan" | "salary_advance" | "helb"
>;

type LoanDeductionInput = {
	loanId: string;
	monthlyInstalment: number;
	description: string;
};

type AdvanceRecoveryInput = {
	advanceId: string;
	recoveryAmount: number;
	description: string;
};

type OtherDeductionInput = {
	type: OtherDeductionType;
	amount: number;
	description: string;
};

type BonusInput = {
	amount: number;
	description: string;
};

export type SlipComputationInput = {
	employee: {
		id: string;
		hasHelbLoan: boolean;
		helbMonthlyDeduction: number;
	};
	salaryStructure: {
		id: string;
		basicSalary: number;
		houseAllowance: number;
		transportAllowance: number;
		commuterAllowance: number;
		mealAllowance: number;
		airtimeAllowance: number;
		otherAllowances: number;
		pensionEmployeeContribution: number;
		pensionEmployerContribution: number;
		mortgageInterestMonthly: number;
		postRetirementMedicalMonthly: number;
		insurancePremiumsMonthly: number;
	};
	prorationInfo: {
		isProrated: boolean;
		proratedDays: number;
		totalWorkingDays: number;
		proratedReason: ProrationReason;
		proratedFactor: number;
	};
	overtimeRecord: {
		id: string;
		weekdayOvertimeHours: number;
		weekendOvertimeHours: number;
		publicHolidayOvertimeHours: number;
		totalOvertimePay: number;
	} | null;
	leaveImpact: {
		unpaidLeaveDays: number;
		halfPayLeaveDays: number;
		workingDaysInMonth: number;
	};
	loans: LoanDeductionInput[];
	advances: AdvanceRecoveryInput[];
	bonuses: BonusInput[];
	otherDeductions: OtherDeductionInput[];
	rates: ResolvedStatutoryRates;
};

export type ComputedPayrollDeductionLine = {
	deductionType: PayrollDeductionType;
	description: string;
	amount: number;
	loanId: string | null;
	advanceId: string | null;
};

export type ComputedEmployeeSlip = {
	salaryStructureId: string;
	isProrated: boolean;
	proratedDays: number | null;
	totalWorkingDaysInPeriod: number | null;
	proratedReason: ProrationReason;
	basicSalary: number;
	houseAllowance: number;
	transportAllowance: number;
	commuterAllowance: number;
	mealAllowance: number;
	airtimeAllowance: number;
	otherAllowances: number;
	overtimePay: number;
	bonuses: number;
	grossPay: number;
	fullMonthGrossPay: number;
	overtimeRecordId: string | null;
	weekdayOvertimeHours: number | null;
	weekendOvertimeHours: number | null;
	publicHolidayOvertimeHours: number | null;
	unpaidLeaveDays: number;
	halfPayLeaveDays: number;
	leaveDeductionAmount: number;
	nssfTier1Employee: number;
	nssfTier1Employer: number;
	nssfTier2Employee: number;
	nssfTier2Employer: number;
	nssfEmployee: number;
	nssfEmployer: number;
	shifEmployee: number;
	shifEmployer: number;
	ahlEmployee: number;
	ahlEmployer: number;
	nitaLevy: number;
	pensionAllowableDeduction: number;
	mortgageAllowableDeduction: number;
	postRetirementAllowableDeduction: number;
	mealAllowanceExempt: number;
	nonCashBenefitExempt: number;
	taxableIncome: number;
	grossTax: number;
	personalRelief: number;
	insuranceRelief: number;
	netPaye: number;
	payeBandBreakdown: string;
	pensionEmployeeDeduction: number;
	pensionEmployerContribution: number;
	totalEmployerCost: number;
	totalLoanDeductions: number;
	totalAdvanceRecoveries: number;
	totalOtherDeductions: number;
	helbDeduction: number;
	totalStatutoryDeductions: number;
	totalVoluntaryDeductions: number;
	totalDeductions: number;
	netPay: number;
	twoThirdsCapApplied: boolean;
	twoThirdsCapAmount: number | null;
};

export type ComputedEmployeeSlipResult = {
	slip: ComputedEmployeeSlip;
	deductionLines: ComputedPayrollDeductionLine[];
	warnings: string[];
	capAdjustedDeductionTotals: {
		requestedLoanDeductions: number;
		requestedAdvanceRecoveries: number;
		requestedOtherDeductions: number;
		appliedLoanDeductions: number;
		appliedAdvanceRecoveries: number;
		appliedOtherDeductions: number;
	};
	loanDeductions: Array<LoanDeductionInput & { appliedAmount: number }>;
	advanceRecoveries: Array<AdvanceRecoveryInput & { appliedAmount: number }>;
	otherDeductionLines: Array<OtherDeductionInput & { appliedAmount: number }>;
};

function sumAmounts(values: number[]) {
	return roundPayrollAmount(values.reduce((total, value) => total + value, 0));
}

function roundValue(value: number) {
	return roundPayrollAmount(value);
}

function applyProrationIfNeeded(value: number, input: SlipComputationInput) {
	return input.prorationInfo.isProrated
		? applyProration(value, input.prorationInfo.proratedFactor)
		: roundValue(value);
}

function scaleGroupAmounts<T extends { amount: number }>(
	items: T[],
	groupReduction: number
): Array<T & { appliedAmount: number }> {
	const requestedTotal = sumAmounts(items.map((item) => item.amount));

	if (requestedTotal <= 0) {
		return items.map((item) => ({ ...item, appliedAmount: 0 }));
	}

	if (groupReduction >= requestedTotal) {
		return items.map((item) => ({ ...item, appliedAmount: 0 }));
	}

	const retainedTotal = roundValue(requestedTotal - groupReduction);
	let runningApplied = 0;

	return items.map((item, index) => {
		if (index === items.length - 1) {
			return {
				...item,
				appliedAmount: roundValue(Math.max(retainedTotal - runningApplied, 0)),
			};
		}

		const appliedAmount = roundValue((item.amount / requestedTotal) * retainedTotal);
		runningApplied = roundValue(runningApplied + appliedAmount);
		return {
			...item,
			appliedAmount,
		};
	});
}

function buildDeductionLines({
	helbDeduction,
	loans,
	advances,
	otherDeductions,
}: {
	helbDeduction: number;
	loans: Array<LoanDeductionInput & { appliedAmount: number }>;
	advances: Array<AdvanceRecoveryInput & { appliedAmount: number }>;
	otherDeductions: Array<OtherDeductionInput & { appliedAmount: number }>;
}) {
	const lines: ComputedPayrollDeductionLine[] = [];

	if (helbDeduction > 0) {
		lines.push({
			deductionType: "helb",
			description: "HELB deduction",
			amount: helbDeduction,
			loanId: null,
			advanceId: null,
		});
	}

	for (const loan of loans) {
		if (loan.appliedAmount <= 0) {
			continue;
		}

		lines.push({
			deductionType: "company_loan",
			description: loan.description,
			amount: loan.appliedAmount,
			loanId: loan.loanId,
			advanceId: null,
		});
	}

	for (const advance of advances) {
		if (advance.appliedAmount <= 0) {
			continue;
		}

		lines.push({
			deductionType: "salary_advance",
			description: advance.description,
			amount: advance.appliedAmount,
			loanId: null,
			advanceId: advance.advanceId,
		});
	}

	for (const deduction of otherDeductions) {
		if (deduction.appliedAmount <= 0) {
			continue;
		}

		lines.push({
			deductionType: deduction.type,
			description: deduction.description,
			amount: deduction.appliedAmount,
			loanId: null,
			advanceId: null,
		});
	}

	return lines;
}

export function computeEmployeeSlip(
	input: SlipComputationInput
): Result<ComputedEmployeeSlipResult> {
	if (input.leaveImpact.workingDaysInMonth <= 0) {
		return failure({
			type: "ValidationError",
			message: "Working days in month must be greater than zero for payroll computation.",
		});
	}

	const fullMonthGrossPay = sumAmounts([
		input.salaryStructure.basicSalary,
		input.salaryStructure.houseAllowance,
		input.salaryStructure.transportAllowance,
		input.salaryStructure.commuterAllowance,
		input.salaryStructure.mealAllowance,
		input.salaryStructure.airtimeAllowance,
		input.salaryStructure.otherAllowances,
	]);

	const basicSalary = applyProrationIfNeeded(input.salaryStructure.basicSalary, input);
	const houseAllowance = applyProrationIfNeeded(input.salaryStructure.houseAllowance, input);
	const transportAllowance = applyProrationIfNeeded(
		input.salaryStructure.transportAllowance,
		input
	);
	const commuterAllowance = applyProrationIfNeeded(
		input.salaryStructure.commuterAllowance,
		input
	);
	const mealAllowance = applyProrationIfNeeded(input.salaryStructure.mealAllowance, input);
	const airtimeAllowance = applyProrationIfNeeded(input.salaryStructure.airtimeAllowance, input);
	const otherAllowances = applyProrationIfNeeded(input.salaryStructure.otherAllowances, input);
	const pensionEmployeeDeduction = applyProrationIfNeeded(
		input.salaryStructure.pensionEmployeeContribution,
		input
	);
	const pensionEmployerContribution = applyProrationIfNeeded(
		input.salaryStructure.pensionEmployerContribution,
		input
	);
	const mortgageInterestMonthly = applyProrationIfNeeded(
		input.salaryStructure.mortgageInterestMonthly,
		input
	);
	const postRetirementMedicalMonthly = applyProrationIfNeeded(
		input.salaryStructure.postRetirementMedicalMonthly,
		input
	);
	const insurancePremiumsMonthly = applyProrationIfNeeded(
		input.salaryStructure.insurancePremiumsMonthly,
		input
	);
	const overtimePay = roundValue(input.overtimeRecord?.totalOvertimePay ?? 0);
	const bonuses = sumAmounts(input.bonuses.map((bonus) => bonus.amount));
	const grossPayBeforeLeave = sumAmounts([
		basicSalary,
		houseAllowance,
		transportAllowance,
		commuterAllowance,
		mealAllowance,
		airtimeAllowance,
		otherAllowances,
		overtimePay,
		bonuses,
	]);
	const dailyRate = roundValue(basicSalary / input.leaveImpact.workingDaysInMonth);
	const unpaidLeaveDeduction = roundValue(dailyRate * input.leaveImpact.unpaidLeaveDays);
	const halfPayLeaveDeduction = roundValue(
		(dailyRate / 2) * input.leaveImpact.halfPayLeaveDays
	);
	const leaveDeductionAmount = sumAmounts([unpaidLeaveDeduction, halfPayLeaveDeduction]);
	const adjustedGrossPay = roundValue(grossPayBeforeLeave - leaveDeductionAmount);

	if (adjustedGrossPay < 0) {
		return failure({
			type: "ValidationError",
			message: "Leave deductions cannot reduce gross pay below zero.",
		});
	}

	const nssf = computeNSSF(adjustedGrossPay, input.rates);
	const shif = computeSHIF(adjustedGrossPay, input.rates);
	const ahl = computeAHL(adjustedGrossPay, input.rates);
	const taxableIncomeResult = computeTaxableIncome(
		adjustedGrossPay,
		nssf.employeeContribution,
		shif.employeeContribution,
		ahl.employeeContribution,
		{
			pensionContribution: pensionEmployeeDeduction,
			mortgageInterest: mortgageInterestMonthly,
			postRetirementMedical: postRetirementMedicalMonthly,
			mealAllowanceActual: mealAllowance,
			nonCashBenefitActual: airtimeAllowance,
		},
		input.rates
	);
	const grossTaxResult = computeGrossTax(
		taxableIncomeResult.taxableIncome,
		input.rates
	);
	const insuranceReliefResult = computeInsuranceRelief(
		insurancePremiumsMonthly,
		input.rates
	);
	const netPayeResult = computeNetPAYE(
		grossTaxResult.grossTax,
		input.rates.personalRelief,
		insuranceReliefResult.reliefAmount
	);
	const nitaLevy = roundValue(input.rates.nitaLevyPerEmployee);
	const helbDeduction = roundValue(
		input.employee.hasHelbLoan ? input.employee.helbMonthlyDeduction : 0
	);
	const requestedLoanDeductions = sumAmounts(
		input.loans.map((loan) => loan.monthlyInstalment)
	);
	const requestedAdvanceRecoveries = sumAmounts(
		input.advances.map((advance) => advance.recoveryAmount)
	);
	const requestedOtherDeductions = sumAmounts(
		input.otherDeductions.map((deduction) => deduction.amount)
	);
	const totalStatutoryDeductions = sumAmounts([
		nssf.employeeContribution,
		shif.employeeContribution,
		ahl.employeeContribution,
		netPayeResult.netPAYE,
	]);
	const twoThirdsCapAmount = roundValue(adjustedGrossPay * (2 / 3));
	const totalRequestedDeductions = sumAmounts([
		totalStatutoryDeductions,
		helbDeduction,
		requestedLoanDeductions,
		requestedAdvanceRecoveries,
		requestedOtherDeductions,
	]);
	const minimumNonReducibleDeductions = sumAmounts([
		totalStatutoryDeductions,
		helbDeduction,
	]);
	const warnings: string[] = [];
	let appliedLoanDeductions = input.loans.map((loan) => ({
		...loan,
		amount: roundValue(loan.monthlyInstalment),
		appliedAmount: roundValue(loan.monthlyInstalment),
	}));
	let appliedAdvanceRecoveries = input.advances.map((advance) => ({
		...advance,
		amount: roundValue(advance.recoveryAmount),
		appliedAmount: roundValue(advance.recoveryAmount),
	}));
	let appliedOtherDeductions = input.otherDeductions.map((deduction) => ({
		...deduction,
		amount: roundValue(deduction.amount),
		appliedAmount: roundValue(deduction.amount),
	}));
	let twoThirdsCapApplied = false;

	if (totalRequestedDeductions > twoThirdsCapAmount) {
		twoThirdsCapApplied = true;

		if (minimumNonReducibleDeductions > twoThirdsCapAmount) {
			return failure({
				type: "ValidationError",
				message:
					"Statutory deductions and HELB exceed the two-thirds cap for this employee.",
			});
		}

		let remainingReduction = roundValue(totalRequestedDeductions - twoThirdsCapAmount);
		const otherReduction = Math.min(requestedOtherDeductions, remainingReduction);
		appliedOtherDeductions = scaleGroupAmounts(
			appliedOtherDeductions,
			roundValue(otherReduction)
		);
		remainingReduction = roundValue(remainingReduction - otherReduction);

		const advanceReduction = Math.min(requestedAdvanceRecoveries, remainingReduction);
		appliedAdvanceRecoveries = scaleGroupAmounts(
			appliedAdvanceRecoveries,
			roundValue(advanceReduction)
		);
		remainingReduction = roundValue(remainingReduction - advanceReduction);

		const loanReduction = Math.min(requestedLoanDeductions, remainingReduction);
		appliedLoanDeductions = scaleGroupAmounts(
			appliedLoanDeductions,
			roundValue(loanReduction)
		);
		remainingReduction = roundValue(remainingReduction - loanReduction);

		if (remainingReduction > 0) {
			return failure({
				type: "ValidationError",
				message:
					"Unable to satisfy the two-thirds cap after reducing voluntary deductions.",
			});
		}

		warnings.push(
			input.prorationInfo.isProrated
				? "Two-thirds cap applied to a prorated payroll slip."
				: "Two-thirds cap applied to reduce voluntary deductions."
		);
	}

	const totalLoanDeductions = sumAmounts(
		appliedLoanDeductions.map((loan) => loan.appliedAmount)
	);
	const totalAdvanceRecoveries = sumAmounts(
		appliedAdvanceRecoveries.map((advance) => advance.appliedAmount)
	);
	const totalOtherDeductions = sumAmounts(
		appliedOtherDeductions.map((deduction) => deduction.appliedAmount)
	);
	const totalVoluntaryDeductions = sumAmounts([
		helbDeduction,
		totalLoanDeductions,
		totalAdvanceRecoveries,
		totalOtherDeductions,
	]);
	const totalDeductions = sumAmounts([
		totalStatutoryDeductions,
		totalVoluntaryDeductions,
	]);
	const netPay = roundValue(adjustedGrossPay - totalDeductions);

	if (netPay < 0) {
		return failure({
			type: "ValidationError",
			message: "Payroll computation would result in a negative net pay.",
		});
	}

	if (input.prorationInfo.isProrated) {
		warnings.push(
			`Proration applied: ${input.prorationInfo.proratedDays}/${input.prorationInfo.totalWorkingDays} working days.`
		);
	}

	if (leaveDeductionAmount > 0) {
		warnings.push(`Leave deduction applied: KES ${leaveDeductionAmount.toFixed(2)}.`);
	}

	const deductionLines = buildDeductionLines({
		helbDeduction,
		loans: appliedLoanDeductions,
		advances: appliedAdvanceRecoveries,
		otherDeductions: appliedOtherDeductions,
	});
	const totalEmployerCost = sumAmounts([
		adjustedGrossPay,
		nssf.employerContribution,
		shif.employerContribution,
		ahl.employerContribution,
		nitaLevy,
		pensionEmployerContribution,
	]);

	return success({
		slip: {
			salaryStructureId: input.salaryStructure.id,
			isProrated: input.prorationInfo.isProrated,
			proratedDays: input.prorationInfo.isProrated ? input.prorationInfo.proratedDays : null,
			totalWorkingDaysInPeriod: input.prorationInfo.isProrated
				? input.prorationInfo.totalWorkingDays
				: null,
			proratedReason: input.prorationInfo.proratedReason,
			basicSalary,
			houseAllowance,
			transportAllowance,
			commuterAllowance,
			mealAllowance,
			airtimeAllowance,
			otherAllowances,
			overtimePay,
			bonuses,
			grossPay: adjustedGrossPay,
			fullMonthGrossPay,
			overtimeRecordId: input.overtimeRecord?.id ?? null,
			weekdayOvertimeHours: input.overtimeRecord?.weekdayOvertimeHours ?? null,
			weekendOvertimeHours: input.overtimeRecord?.weekendOvertimeHours ?? null,
			publicHolidayOvertimeHours: input.overtimeRecord?.publicHolidayOvertimeHours ?? null,
			unpaidLeaveDays: input.leaveImpact.unpaidLeaveDays,
			halfPayLeaveDays: input.leaveImpact.halfPayLeaveDays,
			leaveDeductionAmount,
			nssfTier1Employee: nssf.tier1Employee,
			nssfTier1Employer: nssf.tier1Employer,
			nssfTier2Employee: nssf.tier2Employee,
			nssfTier2Employer: nssf.tier2Employer,
			nssfEmployee: nssf.employeeContribution,
			nssfEmployer: nssf.employerContribution,
			shifEmployee: shif.employeeContribution,
			shifEmployer: shif.employerContribution,
			ahlEmployee: ahl.employeeContribution,
			ahlEmployer: ahl.employerContribution,
			nitaLevy,
			pensionAllowableDeduction:
				taxableIncomeResult.deductionBreakdown.pensionAllowable,
			mortgageAllowableDeduction:
				taxableIncomeResult.deductionBreakdown.mortgageAllowable,
			postRetirementAllowableDeduction:
				taxableIncomeResult.deductionBreakdown.postRetirementAllowable,
			mealAllowanceExempt: taxableIncomeResult.deductionBreakdown.mealExempt,
			nonCashBenefitExempt: taxableIncomeResult.deductionBreakdown.nonCashExempt,
			taxableIncome: taxableIncomeResult.taxableIncome,
			grossTax: grossTaxResult.grossTax,
			personalRelief: roundValue(input.rates.personalRelief),
			insuranceRelief: insuranceReliefResult.reliefAmount,
			netPaye: netPayeResult.netPAYE,
			payeBandBreakdown: JSON.stringify(grossTaxResult.bandBreakdown),
			pensionEmployeeDeduction,
			pensionEmployerContribution,
			totalEmployerCost,
			totalLoanDeductions,
			totalAdvanceRecoveries,
			totalOtherDeductions,
			helbDeduction,
			totalStatutoryDeductions,
			totalVoluntaryDeductions,
			totalDeductions,
			netPay,
			twoThirdsCapApplied,
			twoThirdsCapAmount: twoThirdsCapApplied ? twoThirdsCapAmount : null,
		},
		deductionLines,
		warnings,
		capAdjustedDeductionTotals: {
			requestedLoanDeductions,
			requestedAdvanceRecoveries,
			requestedOtherDeductions,
			appliedLoanDeductions: totalLoanDeductions,
			appliedAdvanceRecoveries: totalAdvanceRecoveries,
			appliedOtherDeductions: totalOtherDeductions,
		},
		loanDeductions: appliedLoanDeductions,
		advanceRecoveries: appliedAdvanceRecoveries,
		otherDeductionLines: appliedOtherDeductions,
	});
}
