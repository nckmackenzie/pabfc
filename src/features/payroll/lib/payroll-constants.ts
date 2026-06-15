export const PAYROLL_STATUTORY_LIMITS = {
	mealAllowanceExemptMonthly: 5000,
	airtimeAllowanceExemptMonthly: 5000,
	pensionAllowableMonthly: 30000,
	mortgageInterestAllowableMonthly: 30000,
	postRetirementMedicalAllowableMonthly: 15000,
	insurancePremiumsReliefInputMonthly: 33333.33,
	insuranceReliefRate: 0.15,
	insuranceReliefCapMonthly: 5000,
	defaultOvertimeHourlyRateDivisor: 225,
} as const;

export const PAYROLL_STATUS = {
	active: "active",
	superseded: "superseded",
	future: "future",
} as const;

export const SALARY_STRUCTURE_METADATA_FIELDS = [
	"notes",
	"pensionFundName",
	"otherAllowancesDescription",
	"hasHelbLoan",
	"helbMonthlyDeduction",
] as const;

export const SALARY_STRUCTURE_FINANCIAL_FIELDS = [
	"effectiveFrom",
	"effectiveTo",
	"payFrequency",
	"basicSalary",
	"houseAllowance",
	"transportAllowance",
	"commuterAllowance",
	"mealAllowance",
	"airtimeAllowance",
	"otherAllowances",
	"pensionEmployeeContribution",
	"pensionEmployerContribution",
	"mortgageInterestMonthly",
	"postRetirementMedicalMonthly",
	"insurancePremiumsMonthly",
	"normalHoursPerDay",
	"normalDaysPerWeek",
	"overtimeHourlyRateDivisor",
	"employeeId",
	"createdBy",
	"isActive",
] as const;
