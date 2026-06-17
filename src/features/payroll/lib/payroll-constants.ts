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
	overtimeMaxHoursPerFortnight: 116,
	overtimeMaxNightHoursPerFortnight: 144,
} as const;

export const OVERTIME_MULTIPLIER_WEEKDAY = 1.5;
export const OVERTIME_MULTIPLIER_WEEKEND = 2.0;
export const OVERTIME_MULTIPLIER_PUBLIC_HOLIDAY = 2.0;
export const LOAN_MAX_DEDUCTION_RATIO = 2 / 3;
export const LOAN_DEFAULT_INTEREST_RATE = 0;
export const LOAN_INTEREST_CALCULATION_METHOD = "reducing_balance" as const;

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
		description: "Credited for total net pay owed to employees; cleared when salaries are disbursed",
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
		description:
			"National Industrial Training Authority levy at KES 50 per employee per month",
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
		description:
			"Employee and employer Affordable Housing Levy pending remittance",
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
