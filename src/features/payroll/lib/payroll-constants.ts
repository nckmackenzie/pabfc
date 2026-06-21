export const PAYE_BANDS = [
	{ lowerBound: 0, upperBound: 24000, rate: 0.1 },
	{ lowerBound: 24001, upperBound: 32333, rate: 0.25 },
	{ lowerBound: 32334, upperBound: 500000, rate: 0.3 },
	{ lowerBound: 500001, upperBound: 800000, rate: 0.325 },
	{ lowerBound: 800001, upperBound: null, rate: 0.35 },
] as const;

export const PAYROLL_SLIP_STATUSES = ["draft", "approved", "cancelled"] as const;

export const NSSF_TIER_1_LOWER_LIMIT = 0;
export const NSSF_TIER_1_UPPER_LIMIT = 8000;
export const NSSF_TIER_2_UPPER_LIMIT = 72000;
export const NSSF_CONTRIBUTION_RATE = 0.06;
export const NSSF_TIER_1_MAX_EMPLOYEE = 480;
export const NSSF_TIER_1_MAX_EMPLOYER = 480;
export const NSSF_TIER_2_MAX_EMPLOYEE = 3840;
export const NSSF_TIER_2_MAX_EMPLOYER = 3840;
export const NSSF_MAX_EMPLOYEE = 4320;
export const NSSF_MAX_EMPLOYER = 4320;

export const SHIF_RATE = 0.0275;
export const SHIF_MINIMUM_CONTRIBUTION = 300;

export const AHL_EMPLOYEE_RATE = 0.015;
export const AHL_EMPLOYER_RATE = 0.015;

export const NITA_LEVY_PER_EMPLOYEE = 50;

export const PAYE_PERSONAL_RELIEF = 2400;
export const PAYE_INSURANCE_RELIEF_RATE = 0.15;
export const PAYE_INSURANCE_RELIEF_MAX = 5000;
export const PAYE_INSURANCE_RELIEF_INPUT_MAX = 33333.33;
export const PAYE_PENSION_ALLOWABLE_MAX = 30000;
export const PAYE_MORTGAGE_ALLOWABLE_MAX = 30000;
export const PAYE_POST_RETIREMENT_MEDICAL_MAX = 15000;
export const PAYE_NON_CASH_BENEFIT_EXEMPT = 5000;
export const PAYE_MEAL_ALLOWANCE_EXEMPT = 5000;

export const STATUTORY_RATE_CATEGORIES = [
	"paye_band",
	"nssf_tier_1_upper_limit",
	"nssf_tier_2_upper_limit",
	"nssf_contribution_rate",
	"nssf_max_employee",
	"nssf_max_employer",
	"shif",
	"ahl_employee_rate",
	"ahl_employer_rate",
	"nita",
	"personal_relief",
	"insurance_relief",
	"pension_cap",
	"mortgage_cap",
	"post_retirement_medical_cap",
	"non_cash_benefit_exempt",
	"meal_allowance_exempt",
] as const;

export type StatutoryRateCategory = (typeof STATUTORY_RATE_CATEGORIES)[number];

export const STATUTORY_RATE_CATEGORY_METADATA = {
	paye_band: {
		label: "PAYE Bands",
		description: "Progressive PAYE tax bands used for gross tax computation.",
		valueType: "band",
	},
	nssf_tier_1_upper_limit: {
		label: "NSSF Tier I Upper Limit",
		description: "Upper pensionable earnings limit for NSSF Tier I.",
		valueType: "fixed",
	},
	nssf_tier_2_upper_limit: {
		label: "NSSF Tier II Upper Limit",
		description: "Upper pensionable earnings limit for NSSF Tier II.",
		valueType: "fixed",
	},
	nssf_contribution_rate: {
		label: "NSSF Contribution Rate",
		description: "Employer and employee NSSF percentage rate.",
		valueType: "rate",
	},
	nssf_max_employee: {
		label: "NSSF Max Employee",
		description: "Maximum monthly employee-side NSSF contribution.",
		valueType: "fixed",
	},
	nssf_max_employer: {
		label: "NSSF Max Employer",
		description: "Maximum monthly employer-side NSSF contribution.",
		valueType: "fixed",
	},
	shif: {
		label: "SHIF",
		description: "SHIF percentage rate and monthly minimum contribution.",
		valueType: "rate_with_fixed",
	},
	ahl_employee_rate: {
		label: "AHL Employee Rate",
		description: "Affordable Housing Levy employee contribution rate.",
		valueType: "rate",
	},
	ahl_employer_rate: {
		label: "AHL Employer Rate",
		description: "Affordable Housing Levy employer contribution rate.",
		valueType: "rate",
	},
	nita: {
		label: "NITA Levy",
		description: "Flat monthly NITA levy per employee.",
		valueType: "fixed",
	},
	personal_relief: {
		label: "Personal Relief",
		description: "Monthly PAYE personal relief amount.",
		valueType: "fixed",
	},
	insurance_relief: {
		label: "Insurance Relief",
		description: "Insurance relief rate and monthly maximum relief cap.",
		valueType: "rate_with_fixed",
	},
	pension_cap: {
		label: "Pension Allowable Cap",
		description: "Maximum monthly employee pension amount allowable for PAYE.",
		valueType: "fixed",
	},
	mortgage_cap: {
		label: "Mortgage Allowable Cap",
		description: "Maximum monthly mortgage interest allowable for PAYE.",
		valueType: "fixed",
	},
	post_retirement_medical_cap: {
		label: "Post-retirement Medical Cap",
		description: "Maximum monthly post-retirement medical amount allowable for PAYE.",
		valueType: "fixed",
	},
	non_cash_benefit_exempt: {
		label: "Non-cash Benefit Exempt",
		description: "Monthly non-cash benefit PAYE exemption threshold.",
		valueType: "fixed",
	},
	meal_allowance_exempt: {
		label: "Meal Allowance Exempt",
		description: "Monthly meal allowance PAYE exemption threshold.",
		valueType: "fixed",
	},
} as const satisfies Record<
	StatutoryRateCategory,
	{
		label: string;
		description: string;
		valueType: "band" | "fixed" | "rate" | "rate_with_fixed";
	}
>;

export const STATUTORY_RATE_CATEGORY_KEYS = Object.keys(
	STATUTORY_RATE_CATEGORY_METADATA
) as Array<StatutoryRateCategory>;

export const STATUTORY_RATE_MULTI_ROW_CATEGORIES = ["paye_band"] as const;

export const STATUTORY_RATE_DEFAULTS = {
	paye: {
		bands: PAYE_BANDS,
		personalRelief: PAYE_PERSONAL_RELIEF,
		insuranceReliefRate: PAYE_INSURANCE_RELIEF_RATE,
		insuranceReliefMax: PAYE_INSURANCE_RELIEF_MAX,
		insuranceReliefInputMax: PAYE_INSURANCE_RELIEF_INPUT_MAX,
		pensionAllowableMax: PAYE_PENSION_ALLOWABLE_MAX,
		mortgageAllowableMax: PAYE_MORTGAGE_ALLOWABLE_MAX,
		postRetirementMedicalMax: PAYE_POST_RETIREMENT_MEDICAL_MAX,
		nonCashBenefitExempt: PAYE_NON_CASH_BENEFIT_EXEMPT,
		mealAllowanceExempt: PAYE_MEAL_ALLOWANCE_EXEMPT,
	},
	nssf: {
		tier1LowerLimit: NSSF_TIER_1_LOWER_LIMIT,
		tier1UpperLimit: NSSF_TIER_1_UPPER_LIMIT,
		tier2UpperLimit: NSSF_TIER_2_UPPER_LIMIT,
		contributionRate: NSSF_CONTRIBUTION_RATE,
		tier1MaxEmployee: NSSF_TIER_1_MAX_EMPLOYEE,
		tier1MaxEmployer: NSSF_TIER_1_MAX_EMPLOYER,
		tier2MaxEmployee: NSSF_TIER_2_MAX_EMPLOYEE,
		tier2MaxEmployer: NSSF_TIER_2_MAX_EMPLOYER,
		maxEmployee: NSSF_MAX_EMPLOYEE,
		maxEmployer: NSSF_MAX_EMPLOYER,
	},
	shif: {
		rate: SHIF_RATE,
		minimumContribution: SHIF_MINIMUM_CONTRIBUTION,
	},
	ahl: {
		employeeRate: AHL_EMPLOYEE_RATE,
		employerRate: AHL_EMPLOYER_RATE,
	},
	nita: {
		levyPerEmployee: NITA_LEVY_PER_EMPLOYEE,
	},
} as const;

export const PAYROLL_STATUTORY_LIMITS = {
	mealAllowanceExemptMonthly: PAYE_MEAL_ALLOWANCE_EXEMPT,
	airtimeAllowanceExemptMonthly: PAYE_NON_CASH_BENEFIT_EXEMPT,
	pensionAllowableMonthly: PAYE_PENSION_ALLOWABLE_MAX,
	mortgageInterestAllowableMonthly: PAYE_MORTGAGE_ALLOWABLE_MAX,
	postRetirementMedicalAllowableMonthly: PAYE_POST_RETIREMENT_MEDICAL_MAX,
	insurancePremiumsReliefInputMonthly: PAYE_INSURANCE_RELIEF_INPUT_MAX,
	insuranceReliefRate: PAYE_INSURANCE_RELIEF_RATE,
	insuranceReliefCapMonthly: PAYE_INSURANCE_RELIEF_MAX,
	defaultOvertimeHourlyRateDivisor: 225,
	overtimeMaxHoursPerFortnight: 116,
	overtimeMaxNightHoursPerFortnight: 144,
} as const;

export const OVERTIME_MULTIPLIER_WEEKDAY = 1.5;
export const OVERTIME_MULTIPLIER_WEEKEND = 2.0;
export const OVERTIME_MULTIPLIER_PUBLIC_HOLIDAY = 2.0;
export const PRORATION_MINIMUM_DAYS = 1;
export const LOAN_MAX_DEDUCTION_RATIO = 2 / 3;
export const LOAN_DEFAULT_INTEREST_RATE = 0;
export const LOAN_INTEREST_CALCULATION_METHOD = "reducing_balance" as const;
export const SALARY_ADVANCE_MAX_RECOVERY_MONTHS = 3;
export const SALARY_ADVANCE_MAX_ADVANCE_RATIO = 0.5;
export const PAYROLL_MONTH_MIN = 1;
export const PAYROLL_MONTH_MAX = 12;
export const PAYROLL_PERIOD_YEAR_MIN = 2020;
export const PAYROLL_PERIOD_YEAR_MAX = 2100;
export const PAYROLL_PAY_DATE_FOLLOWING_MONTH_GRACE_DAYS = 5;
export const STATUTORY_REMITTANCE_DAY = 9;

export const PAYROLL_PERIOD_STATUS = {
	DRAFT: "draft",
	PROCESSING: "processing",
	APPROVED: "approved",
	PAID: "paid",
	CLOSED: "closed",
	CANCELLED: "cancelled",
} as const;

export const PAYROLL_JOURNAL_SOURCES = {
	PAYROLL_RECOGNITION: "payroll_recognition",
	PAYROLL_DISBURSEMENT: "payroll_disbursement",
	PAYROLL_REMITTANCE: "payroll_remittance",
} as const;

export const PAYROLL_REMITTANCE_ITEM_TYPES = [
	"paye",
	"nssf",
	"shif",
	"ahl",
	"nita",
	"helb",
] as const;

export type PayrollPeriodStatus =
	(typeof PAYROLL_PERIOD_STATUS)[keyof typeof PAYROLL_PERIOD_STATUS];

export type PayrollJournalSource =
	(typeof PAYROLL_JOURNAL_SOURCES)[keyof typeof PAYROLL_JOURNAL_SOURCES];

export type PayrollRemittanceItemType = (typeof PAYROLL_REMITTANCE_ITEM_TYPES)[number];

export const PAYROLL_PERIOD_STATUS_VALUES = Object.values(PAYROLL_PERIOD_STATUS) as [
	PayrollPeriodStatus,
	...PayrollPeriodStatus[],
];

export const PAYROLL_STATUS_TRANSITIONS: Record<PayrollPeriodStatus, PayrollPeriodStatus[]> = {
	draft: ["processing", "cancelled"],
	processing: ["approved", "cancelled"],
	approved: ["paid"],
	paid: ["closed"],
	closed: [],
	cancelled: [],
};

export const OVERTIME_MAX_HOURS_PER_FORTNIGHT =
	PAYROLL_STATUTORY_LIMITS.overtimeMaxHoursPerFortnight;
export const OVERTIME_MAX_NIGHT_HOURS_PER_FORTNIGHT =
	PAYROLL_STATUTORY_LIMITS.overtimeMaxNightHoursPerFortnight;

export const OVERTIME_STATUS = {
	DRAFT: "draft",
	APPROVED: "approved",
	PAID: "paid",
} as const;

export const LOAN_STATUS = {
	PENDING: "pending",
	ACTIVE: "active",
	PAUSED: "paused",
	FULLY_PAID: "fully_paid",
	WRITTEN_OFF: "written_off",
	REJECTED: "rejected",
} as const;

export const SALARY_ADVANCE_STATUS = {
	PENDING: "pending",
	APPROVED: "approved",
	DISBURSED: "disbursed",
	RECOVERING: "recovering",
	FULLY_RECOVERED: "fully_recovered",
	REJECTED: "rejected",
	CANCELLED: "cancelled",
} as const;

export const PAYROLL_ACCOUNT_ROLES = {
	salaries_expense: {
		label: "Salaries & Wages Expense",
		description: "Debited for total gross pay of all employees in the period",
	},
	overtime_expense: {
		label: "Overtime Expense",
		description: "Debited for total overtime pay if tracked separately from basic salary",
	},
	bonus_expense: {
		label: "Bonus & Incentive Expense",
		description: "Debited for any bonuses paid in the period",
	},
	nssf_employer_expense: {
		label: "Employer NSSF Contribution Expense",
		description: "Debited for the employer's matching NSSF contribution",
	},
	shif_employer_expense: {
		label: "Employer SHIF Contribution Expense",
		description: "Debited for the employer's matching SHIF contribution",
	},
	ahl_employer_expense: {
		label: "Employer AHL Contribution Expense",
		description: "Debited for the employer's matching Affordable Housing Levy",
	},
	nita_expense: {
		label: "NITA Levy Expense",
		description: "Debited for KES 50 per employee per month",
	},
	pension_employer_expense: {
		label: "Employer Pension Contribution Expense",
		description: "Debited for any employer matching pension contributions",
	},
	loans_receivable: {
		label: "Employee Loans Receivable",
		description: "Debited when employee loans are disbursed and credited when they are repaid",
	},
	salary_advance_receivable: {
		label: "Salary Advance Receivable",
		description:
			"Debited when a salary advance is disbursed to an employee; credited when the advance is recovered through payroll deductions. This is an asset account.",
	},
	paye_payable: {
		label: "PAYE Payable",
		description: "Credited for total PAYE withheld; cleared when remitted to KRA",
	},
	nssf_payable: {
		label: "NSSF Payable",
		description: "Credited for combined employee and employer NSSF; cleared when remitted to NSSF",
	},
	shif_payable: {
		label: "SHIF Payable",
		description: "Credited for combined employee and employer SHIF; cleared when remitted to SHA",
	},
	ahl_payable: {
		label: "AHL Payable",
		description: "Credited for combined employee and employer AHL; cleared when remitted to KRA",
	},
	nita_payable: {
		label: "NITA Payable",
		description: "Credited for NITA levy; cleared when remitted to NITA",
	},
	helb_payable: {
		label: "HELB Payable",
		description: "Credited for HELB deductions withheld; cleared when remitted to HELB",
	},
	loan_deductions_payable: {
		label: "Employee Loan Deductions Payable",
		description: "Credited for company loan repayment deductions withheld from employees",
	},
	other_deductions_payable: {
		label: "Other Payroll Deductions Payable",
		description: "Credited for SACCO, union dues, and any other voluntary deductions",
	},
	net_salaries_payable: {
		label: "Net Salaries Payable",
		description:
			"Credited for total net pay owed to employees; cleared when salaries are disbursed",
	},
	salary_advance_payable: {
		label: "Salary Advance Recovery Payable",
		description: "Credited for salary advance recoveries withheld",
	},
} as const;

export type PayrollAccountRole = keyof typeof PAYROLL_ACCOUNT_ROLES;

export const PAYROLL_ACCOUNT_ROLE_KEYS = Object.keys(
	PAYROLL_ACCOUNT_ROLES
) as Array<PayrollAccountRole>;

export const PAYROLL_PARENT_LEDGER_ACCOUNTS = [
	{
		code: "1090",
		name: "Payroll Receivables",
		description: "Reporting parent for payroll-related receivable accounts",
		type: "asset",
		normalBalance: "debit",
		parentCode: null,
	},
	{
		code: "1091",
		name: "Employee Payroll Receivables",
		description: "Reporting parent for payroll receivables recoverable from employees",
		type: "asset",
		normalBalance: "debit",
		parentCode: "1090",
	},
	{
		code: "5090",
		name: "Payroll Expenses",
		description: "Reporting parent for all payroll-related expense accounts",
		type: "expense",
		normalBalance: "debit",
		parentCode: null,
	},
	{
		code: "5091",
		name: "Earnings & Compensation Expenses",
		description: "Reporting parent for salaries, overtime, and bonus payroll expenses",
		type: "expense",
		normalBalance: "debit",
		parentCode: "5090",
	},
	{
		code: "5092",
		name: "Employer Payroll Contribution Expenses",
		description: "Reporting parent for employer statutory and pension payroll expenses",
		type: "expense",
		normalBalance: "debit",
		parentCode: "5090",
	},
	{
		code: "2090",
		name: "Payroll Liabilities",
		description: "Reporting parent for all payroll-related liability accounts",
		type: "liability",
		normalBalance: "credit",
		parentCode: null,
	},
	{
		code: "2091",
		name: "Statutory Payroll Liabilities",
		description: "Reporting parent for statutory payroll remittance liabilities",
		type: "liability",
		normalBalance: "credit",
		parentCode: "2090",
	},
	{
		code: "2092",
		name: "Employee Payroll Payables",
		description: "Reporting parent for net salaries and employee-related payroll payables",
		type: "liability",
		normalBalance: "credit",
		parentCode: "2090",
	},
] as const;

export const PAYROLL_ROLE_DEFAULT_ACCOUNT_CODES = {
	salaries_expense: "5100",
	overtime_expense: "5101",
	bonus_expense: "5102",
	nssf_employer_expense: "5110",
	shif_employer_expense: "5111",
	ahl_employer_expense: "5112",
	nita_expense: "5113",
	pension_employer_expense: "5114",
	loans_receivable: "1150",
	salary_advance_receivable: "1151",
	paye_payable: "2101",
	nssf_payable: "2102",
	shif_payable: "2103",
	ahl_payable: "2104",
	nita_payable: "2105",
	helb_payable: "2106",
	loan_deductions_payable: "2107",
	other_deductions_payable: "2108",
	net_salaries_payable: "2100",
	salary_advance_payable: "2109",
} as const satisfies Record<PayrollAccountRole, string>;

export const PAYROLL_DEFAULT_LEDGER_ACCOUNTS = [
	{
		code: "5100",
		name: "Salaries & Wages",
		description: "Gross payroll expense for all employees",
		type: "expense",
		normalBalance: "debit",
	},
	{
		code: "5101",
		name: "Overtime Expense",
		description: "Overtime pay for hours worked beyond normal hours",
		type: "expense",
		normalBalance: "debit",
	},
	{
		code: "5102",
		name: "Bonus & Incentive Expense",
		description: "Bonuses and performance incentives",
		type: "expense",
		normalBalance: "debit",
	},
	{
		code: "5110",
		name: "Employer NSSF Contribution",
		description: "Employer matching NSSF pension contributions",
		type: "expense",
		normalBalance: "debit",
	},
	{
		code: "5111",
		name: "Employer SHIF Contribution",
		description: "Employer matching Social Health Insurance Fund contributions",
		type: "expense",
		normalBalance: "debit",
	},
	{
		code: "5112",
		name: "Employer AHL Contribution",
		description: "Employer matching Affordable Housing Levy",
		type: "expense",
		normalBalance: "debit",
	},
	{
		code: "5113",
		name: "NITA Levy",
		description: "National Industrial Training Authority levy at KES 50 per employee per month",
		type: "expense",
		normalBalance: "debit",
	},
	{
		code: "5114",
		name: "Employer Pension Contribution",
		description: "Employer contributions to registered pension or provident fund",
		type: "expense",
		normalBalance: "debit",
	},
	{
		code: "1150",
		name: "Employee Loans Receivable",
		description: "Receivable balance for employee loans disbursed by the company",
		type: "asset",
		normalBalance: "debit",
	},
	{
		code: "1151",
		name: "Salary Advance Receivable",
		description: "Salary advances disbursed to employees pending recovery through payroll",
		type: "asset",
		normalBalance: "debit",
	},
	{
		code: "2100",
		name: "Net Salaries Payable",
		description: "Net pay owed to employees pending disbursement",
		type: "liability",
		normalBalance: "credit",
	},
	{
		code: "2101",
		name: "PAYE Payable",
		description: "Pay As You Earn tax withheld pending remittance to KRA",
		type: "liability",
		normalBalance: "credit",
	},
	{
		code: "2102",
		name: "NSSF Payable",
		description: "Employee and employer NSSF contributions pending remittance",
		type: "liability",
		normalBalance: "credit",
	},
	{
		code: "2103",
		name: "SHIF Payable",
		description: "Employee and employer SHIF contributions pending remittance to SHA",
		type: "liability",
		normalBalance: "credit",
	},
	{
		code: "2104",
		name: "AHL Payable",
		description: "Employee and employer Affordable Housing Levy pending remittance",
		type: "liability",
		normalBalance: "credit",
	},
	{
		code: "2105",
		name: "NITA Payable",
		description: "NITA levy pending remittance",
		type: "liability",
		normalBalance: "credit",
	},
	{
		code: "2106",
		name: "HELB Payable",
		description: "HELB loan deductions withheld pending remittance",
		type: "liability",
		normalBalance: "credit",
	},
	{
		code: "2107",
		name: "Employee Loan Deductions Payable",
		description: "Company loan repayment deductions withheld from employees",
		type: "liability",
		normalBalance: "credit",
	},
	{
		code: "2108",
		name: "Other Payroll Deductions Payable",
		description: "SACCO, union dues and other voluntary deductions withheld",
		type: "liability",
		normalBalance: "credit",
	},
	{
		code: "2109",
		name: "Salary Advance Recovery Payable",
		description: "Salary advances being recovered through payroll",
		type: "liability",
		normalBalance: "credit",
	},
] as const;

export const PAYROLL_DEFAULT_ACCOUNT_PARENT_CODES = {
	"1150": "1091",
	"1151": "1091",
	"5100": "5091",
	"5101": "5091",
	"5102": "5091",
	"5110": "5092",
	"5111": "5092",
	"5112": "5092",
	"5113": "5092",
	"5114": "5092",
	"2100": "2092",
	"2101": "2091",
	"2102": "2091",
	"2103": "2091",
	"2104": "2091",
	"2105": "2091",
	"2106": "2091",
	"2107": "2092",
	"2108": "2092",
	"2109": "2092",
} as const satisfies Record<(typeof PAYROLL_DEFAULT_LEDGER_ACCOUNTS)[number]["code"], string>;

export const PAYROLL_ACCOUNT_ROLE_REQUIRED_ACCOUNT_TYPES = {
	salaries_expense: "expense",
	overtime_expense: "expense",
	bonus_expense: "expense",
	nssf_employer_expense: "expense",
	shif_employer_expense: "expense",
	ahl_employer_expense: "expense",
	nita_expense: "expense",
	pension_employer_expense: "expense",
	loans_receivable: "asset",
	salary_advance_receivable: "asset",
	paye_payable: "liability",
	nssf_payable: "liability",
	shif_payable: "liability",
	ahl_payable: "liability",
	nita_payable: "liability",
	helb_payable: "liability",
	loan_deductions_payable: "liability",
	other_deductions_payable: "liability",
	net_salaries_payable: "liability",
	salary_advance_payable: "liability",
} as const satisfies Record<PayrollAccountRole, "asset" | "expense" | "liability">;

export const PAYROLL_STATUS = {
	active: "active",
	superseded: "superseded",
	future: "future",
} as const;

export const SALARY_STRUCTURE_METADATA_FIELDS = [
	"notes",
	"pensionFundName",
	"otherAllowancesDescription",
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
