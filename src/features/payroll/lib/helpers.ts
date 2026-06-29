import type { salaryStructures } from "@/drizzle/schema";
import {
	OVERTIME_MULTIPLIER_PUBLIC_HOLIDAY,
	OVERTIME_MULTIPLIER_WEEKDAY,
	OVERTIME_MULTIPLIER_WEEKEND,
	PAYROLL_STATUTORY_LIMITS,
	PAYROLL_STATUS,
} from "@/features/payroll/lib/payroll-constants";
import type { SalaryStructureCreateFormInput } from "../services/schemas";
import { roundDecimal, toBig } from "@/lib/helpers";

type SalaryStructureRecord = typeof salaryStructures.$inferSelect;
type NumericLike = number | string | Big | null | undefined;
type SalaryStructureFormValues = {
	id?: string;
	employeeId: string;
	effectiveFrom: string;
	effectiveTo: string | null;
	payFrequency: "monthly" | "bi_weekly" | "weekly";
	basicSalary: number;
	houseAllowance: number;
	transportAllowance: number;
	commuterAllowance: number;
	mealAllowance: number;
	airtimeAllowance: number;
	otherAllowances: number;
	otherAllowancesDescription: string | null;
	pensionEmployeeContribution: number;
	pensionEmployerContribution: number;
	pensionFundName: string | null;
	mortgageInterestMonthly: number;
	postRetirementMedicalMonthly: number;
	insurancePremiumsMonthly: number;
	hasHelbLoan: boolean;
	helbMonthlyDeduction: number;
	normalHoursPerDay: number;
	normalDaysPerWeek: number;
	overtimeHourlyRateDivisor: number;
	notes: string | null;
};

export const formatSalaryStructureFormValues = (data: SalaryStructureCreateFormInput) => {
	return {
		...data,
		employeeId: data.employeeId,
		effectiveFrom: data.effectiveFrom,
		effectiveTo: data.effectiveTo,
		payFrequency: data.payFrequency,
		basicSalary: data.basicSalary,
		houseAllowance: data.houseAllowance ?? 0,
		transportAllowance: data.transportAllowance ?? 0,
		commuterAllowance: data.commuterAllowance ?? 0,
		mealAllowance: data.mealAllowance ?? 0,
		airtimeAllowance: data.airtimeAllowance ?? 0,
		otherAllowances: data.otherAllowances ?? 0,
		otherAllowancesDescription: data.otherAllowancesDescription,
		pensionEmployeeContribution: data.pensionEmployeeContribution ?? 0,
		pensionEmployerContribution: data.pensionEmployerContribution ?? 0,
		pensionFundName: data.pensionFundName,
		mortgageInterestMonthly: data.mortgageInterestMonthly ?? 0,
		postRetirementMedicalMonthly: data.postRetirementMedicalMonthly ?? 0,
		insurancePremiumsMonthly: data.insurancePremiumsMonthly ?? 0,
		hasHelbLoan: data.hasHelbLoan,
		helbMonthlyDeduction: data.helbMonthlyDeduction ?? 0,
		normalHoursPerDay: data.normalHoursPerDay,
		normalDaysPerWeek: data.normalDaysPerWeek,
		overtimeHourlyRateDivisor: data.overtimeHourlyRateDivisor,
		notes: data.notes,
	} satisfies SalaryStructureFormValues;
};

export type SalaryHistoryStatus = (typeof PAYROLL_STATUS)[keyof typeof PAYROLL_STATUS];

export type SalaryStructureWithComputedComponents = SalaryStructureRecord & {
	computedComponents: ReturnType<typeof computeGrossPayComponents>;
};

export function subtractOneDay(isoDate: string) {
	const date = new Date(`${isoDate}T00:00:00.000Z`);
	date.setUTCDate(date.getUTCDate() - 1);
	return date.toISOString().slice(0, 10);
}

export function formatSalaryStructureDateRange({
	effectiveFrom,
	effectiveTo,
}: Pick<SalaryStructureRecord, "effectiveFrom" | "effectiveTo">) {
	return `${effectiveFrom} to ${effectiveTo ?? "open-ended"}`;
}

export function getSalaryHistoryStatus({
	effectiveFrom,
	effectiveTo,
	today,
}: {
	effectiveFrom: string;
	effectiveTo: string | null;
	today?: string;
}): SalaryHistoryStatus {
	const referenceDate = today ?? new Date().toISOString().slice(0, 10);

	if (effectiveFrom > referenceDate) {
		return PAYROLL_STATUS.future;
	}

	if (effectiveTo === null) {
		return PAYROLL_STATUS.active;
	}

	return effectiveTo < referenceDate ? PAYROLL_STATUS.superseded : PAYROLL_STATUS.active;
}

export function canAutoCloseCurrentStructure({
	existingEffectiveFrom,
	existingEffectiveTo,
	newEffectiveFrom,
}: {
	existingEffectiveFrom: string;
	existingEffectiveTo: string | null;
	newEffectiveFrom: string;
}) {
	return existingEffectiveTo === null && existingEffectiveFrom < newEffectiveFrom;
}

export function doSalaryRangesOverlap({
	existingEffectiveFrom,
	existingEffectiveTo,
	newEffectiveFrom,
	newEffectiveTo,
}: {
	existingEffectiveFrom: string;
	existingEffectiveTo: string | null;
	newEffectiveFrom: string;
	newEffectiveTo: string | null;
}) {
	const newEndsAt = newEffectiveTo ?? "9999-12-31";
	const existingEndsAt = existingEffectiveTo ?? "9999-12-31";

	return existingEffectiveFrom <= newEndsAt && existingEndsAt >= newEffectiveFrom;
}

export function computeGrossPayComponents(structure: SalaryStructureRecord) {
	const basicSalary = roundDecimal(structure.basicSalary);
	const houseAllowance = roundDecimal(structure.houseAllowance);
	const transportAllowance = roundDecimal(structure.transportAllowance);
	const commuterAllowance = roundDecimal(structure.commuterAllowance);
	const mealAllowance = roundDecimal(structure.mealAllowance);
	const airtimeAllowance = roundDecimal(structure.airtimeAllowance);
	const otherAllowances = roundDecimal(structure.otherAllowances);
	const pensionEmployeeContribution = roundDecimal(structure.pensionEmployeeContribution);
	const mortgageInterestMonthly = roundDecimal(structure.mortgageInterestMonthly);
	const postRetirementMedicalMonthly = roundDecimal(structure.postRetirementMedicalMonthly);
	const insurancePremiumsMonthly = roundDecimal(structure.insurancePremiumsMonthly);
	const helbMonthlyDeduction = roundDecimal(
		structure.hasHelbLoan ? structure.helbMonthlyDeduction : 0
	);
	const overtimeHourlyRateDivisor = structure.overtimeHourlyRateDivisor || 1;

	const grossPay = roundDecimal(
		toBig(basicSalary)
			.plus(houseAllowance)
			.plus(transportAllowance)
			.plus(commuterAllowance)
			.plus(mealAllowance)
			.plus(airtimeAllowance)
			.plus(otherAllowances)
	);

	const mealAllowanceExempt = roundDecimal(
		Math.min(mealAllowance, PAYROLL_STATUTORY_LIMITS.mealAllowanceExemptMonthly)
	);
	const mealAllowanceTaxable = roundDecimal(toBig(mealAllowance).minus(mealAllowanceExempt));
	const airtimeAllowanceExempt = roundDecimal(
		Math.min(airtimeAllowance, PAYROLL_STATUTORY_LIMITS.airtimeAllowanceExemptMonthly)
	);
	const airtimeAllowanceTaxable = roundDecimal(
		toBig(airtimeAllowance).minus(airtimeAllowanceExempt)
	);

	const pensionAllowableDeduction = roundDecimal(
		Math.min(pensionEmployeeContribution, PAYROLL_STATUTORY_LIMITS.pensionAllowableMonthly)
	);
	const mortgageAllowableDeduction = roundDecimal(
		Math.min(mortgageInterestMonthly, PAYROLL_STATUTORY_LIMITS.mortgageInterestAllowableMonthly)
	);
	const postRetirementAllowableDeduction = roundDecimal(
		Math.min(
			postRetirementMedicalMonthly,
			PAYROLL_STATUTORY_LIMITS.postRetirementMedicalAllowableMonthly
		)
	);
	const insurancePremiumsForRelief = roundDecimal(
		Math.min(insurancePremiumsMonthly, PAYROLL_STATUTORY_LIMITS.insurancePremiumsReliefInputMonthly)
	);
	const overtimeHourlyRate = roundDecimal(toBig(basicSalary).div(overtimeHourlyRateDivisor));

	return {
		basicSalary,
		houseAllowance,
		transportAllowance,
		commuterAllowance,
		mealAllowance,
		airtimeAllowance,
		otherAllowances,
		grossPay,
		mealAllowanceExempt,
		mealAllowanceTaxable,
		airtimeAllowanceExempt,
		airtimeAllowanceTaxable,
		pensionAllowableDeduction,
		mortgageAllowableDeduction,
		postRetirementAllowableDeduction,
		insurancePremiumsForRelief,
		overtimeHourlyRate,
		hasHelbLoan: structure.hasHelbLoan,
		helbMonthlyDeduction,
	};
}

export function getMonthBoundaryDate(
	periodYear: number,
	periodMonth: number,
	boundary: "start" | "end"
) {
	const date =
		boundary === "start"
			? new Date(Date.UTC(periodYear, periodMonth - 1, 1))
			: new Date(Date.UTC(periodYear, periodMonth, 0));

	return date.toISOString().slice(0, 10);
}

export function getCurrentPeriodParts(today = new Date()) {
	return {
		periodMonth: today.getUTCMonth() + 1,
		periodYear: today.getUTCFullYear(),
	};
}

export function isFuturePayrollPeriod(periodMonth: number, periodYear: number, today = new Date()) {
	const current = getCurrentPeriodParts(today);

	if (periodYear > current.periodYear) {
		return true;
	}

	if (periodYear < current.periodYear) {
		return false;
	}

	return periodMonth > current.periodMonth;
}

export function getPeriodIndex(periodMonth: number, periodYear: number) {
	return periodYear * 100 + periodMonth;
}

export function computeOvertimePay(
	weekdayHours: NumericLike,
	weekendHours: NumericLike,
	publicHolidayHours: NumericLike,
	overtimeHourlyRate: NumericLike
) {
	const parsedWeekdayHours = toBig(weekdayHours);
	const parsedWeekendHours = toBig(weekendHours);
	const parsedPublicHolidayHours = toBig(publicHolidayHours);
	const parsedOvertimeHourlyRate = toBig(overtimeHourlyRate);

	const weekdayOvertimePay = roundDecimal(
		parsedWeekdayHours.times(parsedOvertimeHourlyRate).times(OVERTIME_MULTIPLIER_WEEKDAY)
	);
	const weekendOvertimePay = roundDecimal(
		parsedWeekendHours.times(parsedOvertimeHourlyRate).times(OVERTIME_MULTIPLIER_WEEKEND)
	);
	const publicHolidayOvertimePay = roundDecimal(
		parsedPublicHolidayHours
			.times(parsedOvertimeHourlyRate)
			.times(OVERTIME_MULTIPLIER_PUBLIC_HOLIDAY)
	);
	const totalOvertimePay = roundDecimal(
		toBig(weekdayOvertimePay).plus(weekendOvertimePay).plus(publicHolidayOvertimePay)
	);

	return {
		weekdayOvertimePay,
		weekendOvertimePay,
		publicHolidayOvertimePay,
		totalOvertimePay,
		overtimeHourlyRate: roundDecimal(parsedOvertimeHourlyRate),
	};
}
