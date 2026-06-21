import { relations, sql } from "drizzle-orm";
import {
	boolean,
	check,
	date,
	index,
	integer,
	numeric,
	pgEnum,
	pgTable,
	serial,
	text,
	timestamp,
	uniqueIndex,
	varchar,
} from "drizzle-orm/pg-core";
import { createdAt, updatedAt } from "@/drizzle/schema-helpers";
import {
	LOAN_STATUS,
	PAYROLL_ACCOUNT_ROLE_KEYS,
	PAYROLL_PERIOD_STATUS_VALUES,
	SALARY_ADVANCE_STATUS,
	STATUTORY_RATE_CATEGORIES,
	type StatutoryRateCategory,
	type PayrollPeriodStatus,
	type PayrollAccountRole,
	PAYROLL_SLIP_STATUSES,
} from "@/features/payroll/lib/payroll-constants";
import { users } from "./auth";
import { journalEntries, ledgerAccounts } from "./chart-of-accounts";
import { employees } from "./employees";
import { nanoid } from "nanoid";

export const PAY_FREQUENCIES = ["monthly", "bi_weekly", "weekly"] as const;
export type PayFrequency = (typeof PAY_FREQUENCIES)[number];

export const payFrequencyEnum = pgEnum("pay_frequency", PAY_FREQUENCIES);
const payrollAccountRoleValues = PAYROLL_ACCOUNT_ROLE_KEYS as [
	PayrollAccountRole,
	...Array<PayrollAccountRole>,
];
const payrollPeriodStatusValues = PAYROLL_PERIOD_STATUS_VALUES as [
	PayrollPeriodStatus,
	...Array<PayrollPeriodStatus>,
];
const statutoryRateCategoryValues = STATUTORY_RATE_CATEGORIES as unknown as [
	StatutoryRateCategory,
	...Array<StatutoryRateCategory>,
];
export const OVERTIME_STATUSES = ["draft", "approved", "paid"] as const;

export const PAYROLL_DEDUCTION_TYPES = [
	"company_loan",
	"salary_advance",
	"sacco",
	"union_dues",
	"court_order",
	"insurance",
	"welfare",
	"helb",
	"other",
] as const;
export type OvertimeStatus = (typeof OVERTIME_STATUSES)[number];
export type PayrollSlipStatus = (typeof PAYROLL_SLIP_STATUSES)[number];
export type PayrollDeductionType = (typeof PAYROLL_DEDUCTION_TYPES)[number];
const loanStatusValues = Object.values(LOAN_STATUS) as [string & {}, ...(string & {})[]];
const salaryAdvanceStatusValues = Object.values(SALARY_ADVANCE_STATUS) as [
	string & {},
	...(string & {})[],
];
export type LoanStatus = (typeof loanStatusValues)[number];
export type SalaryAdvanceStatus = (typeof salaryAdvanceStatusValues)[number];

export const payrollAccountRoleEnum = pgEnum("payroll_account_role", payrollAccountRoleValues);
export const payrollPeriodStatusEnum = pgEnum("payroll_period_status", payrollPeriodStatusValues);
export const statutoryRateCategoryEnum = pgEnum(
	"statutory_rate_category",
	statutoryRateCategoryValues
);
export const overtimeStatusEnum = pgEnum("overtime_status", OVERTIME_STATUSES);
export const payrollSlipStatusEnum = pgEnum("payroll_slip_status", PAYROLL_SLIP_STATUSES);
export const payrollDeductionTypeEnum = pgEnum("payroll_deduction_type", PAYROLL_DEDUCTION_TYPES);
export const loanStatusEnum = pgEnum("loan_status", loanStatusValues);
export const salaryAdvanceStatusEnum = pgEnum("salary_advance_status", salaryAdvanceStatusValues);

export const salaryStructures = pgTable(
	"salary_structures",
	{
		id: varchar("id")
			.primaryKey()
			.$defaultFn(() => nanoid()),
		employeeId: varchar("employee_id", { length: 255 })
			.notNull()
			.references(() => employees.id, { onDelete: "cascade" }),
		effectiveFrom: date("effective_from").notNull(),
		effectiveTo: date("effective_to"),
		payFrequency: payFrequencyEnum("pay_frequency").notNull().default("monthly"),
		basicSalary: numeric("basic_salary", {
			precision: 14,
			scale: 2,
		}).notNull(),
		houseAllowance: numeric("house_allowance", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		transportAllowance: numeric("transport_allowance", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		commuterAllowance: numeric("commuter_allowance", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		mealAllowance: numeric("meal_allowance", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		airtimeAllowance: numeric("airtime_allowance", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		otherAllowances: numeric("other_allowances", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		otherAllowancesDescription: varchar("other_allowances_description", {
			length: 255,
		}),
		pensionEmployeeContribution: numeric("pension_employee_contribution", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		pensionEmployerContribution: numeric("pension_employer_contribution", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		pensionFundName: varchar("pension_fund_name", { length: 100 }),
		mortgageInterestMonthly: numeric("mortgage_interest_monthly", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		postRetirementMedicalMonthly: numeric("post_retirement_medical_monthly", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		insurancePremiumsMonthly: numeric("insurance_premiums_monthly", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		hasHelbLoan: boolean("has_helb_loan").notNull().default(false),
		helbMonthlyDeduction: numeric("helb_monthly_deduction", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		normalHoursPerDay: numeric("normal_hours_per_day", {
			precision: 4,
			scale: 2,
		})
			.notNull()
			.default("8"),
		normalDaysPerWeek: numeric("normal_days_per_week", {
			precision: 4,
			scale: 2,
		})
			.notNull()
			.default("5"),
		overtimeHourlyRateDivisor: integer("overtime_hourly_rate_divisor").notNull().default(225),
		isActive: boolean("is_active").notNull().default(true),
		notes: text("notes"),
		createdBy: varchar("created_by", { length: 255 }).references(() => users.id, {
			onDelete: "set null",
		}),
		createdAt,
		updatedAt,
	},
	(table) => [
		index("idx_salary_structures_employee").on(table.employeeId),
		index("idx_salary_structures_employee_effective_from").on(
			table.employeeId,
			table.effectiveFrom
		),
		index("idx_salary_structures_employee_effective_to").on(table.employeeId, table.effectiveTo),
		index("idx_salary_structures_employee_active").on(table.employeeId, table.isActive),
		check(
			"salary_structures_effective_to_after_from",
			sql`${table.effectiveTo} is null or ${table.effectiveTo} > ${table.effectiveFrom}`
		),
	]
);

export const payrollPeriods = pgTable(
	"payroll_periods",
	{
		id: varchar("id", { length: 255 })
			.primaryKey()
			.$defaultFn(() => nanoid()),
		name: varchar("name", { length: 50 }).notNull(),
		periodMonth: integer("period_month").notNull(),
		periodYear: integer("period_year").notNull(),
		periodStart: date("period_start").notNull(),
		periodEnd: date("period_end").notNull(),
		payDate: date("pay_date").notNull(),
		status: payrollPeriodStatusEnum("status").notNull().default("draft"),
		totalGrossPay: numeric("total_gross_pay", {
			precision: 14,
			scale: 2,
		}),
		totalNetPay: numeric("total_net_pay", {
			precision: 14,
			scale: 2,
		}),
		totalPaye: numeric("total_paye", {
			precision: 14,
			scale: 2,
		}),
		totalNssfEmployee: numeric("total_nssf_employee", {
			precision: 14,
			scale: 2,
		}),
		totalNssfEmployer: numeric("total_nssf_employer", {
			precision: 14,
			scale: 2,
		}),
		totalShifEmployee: numeric("total_shif_employee", {
			precision: 14,
			scale: 2,
		}),
		totalShifEmployer: numeric("total_shif_employer", {
			precision: 14,
			scale: 2,
		}),
		totalAhlEmployee: numeric("total_ahl_employee", {
			precision: 14,
			scale: 2,
		}),
		totalAhlEmployer: numeric("total_ahl_employer", {
			precision: 14,
			scale: 2,
		}),
		totalNita: numeric("total_nita", {
			precision: 14,
			scale: 2,
		}),
		totalLoanDeductions: numeric("total_loan_deductions", {
			precision: 14,
			scale: 2,
		}),
		totalAdvanceRecoveries: numeric("total_advance_recoveries", {
			precision: 14,
			scale: 2,
		}),
		totalOtherDeductions: numeric("total_other_deductions", {
			precision: 14,
			scale: 2,
		}),
		totalPensionEmployer: numeric("total_pension_employer", {
			precision: 14,
			scale: 2,
		}),
		employeeCount: integer("employee_count"),
		processingWarnings: text("processing_warnings"),
		skippedEmployees: text("skipped_employees"),
		processingStartedAt: timestamp("processing_started_at", { withTimezone: true }),
		processingCompletedAt: timestamp("processing_completed_at", { withTimezone: true }),
		approvedBy: varchar("approved_by", { length: 255 }).references(() => users.id, {
			onDelete: "set null",
		}),
		approvedAt: timestamp("approved_at", { withTimezone: true }),
		paidAt: timestamp("paid_at", { withTimezone: true }),
		closedAt: timestamp("closed_at", { withTimezone: true }),
		cancelledBy: varchar("cancelled_by", { length: 255 }).references(() => users.id, {
			onDelete: "set null",
		}),
		cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
		cancellationReason: text("cancellation_reason"),
		disbursementJournalEntryId: integer("disbursement_journal_entry_id").references(
			() => journalEntries.id,
			{ onDelete: "set null" }
		),
		remittanceJournalEntryId: integer("remittance_journal_entry_id").references(
			() => journalEntries.id,
			{ onDelete: "set null" }
		),
		payrollJournalEntryId: integer("payroll_journal_entry_id").references(() => journalEntries.id, {
			onDelete: "set null",
		}),
		notes: text("notes"),
		createdBy: varchar("created_by", { length: 255 }).references(() => users.id, {
			onDelete: "set null",
		}),
		createdAt,
		updatedAt,
	},
	(table) => [
		uniqueIndex("uq_payroll_periods_month_year_active")
			.on(table.periodMonth, table.periodYear)
			.where(sql`${table.status} <> 'cancelled'`),
		index("idx_payroll_periods_status").on(table.status),
		index("idx_payroll_periods_pay_date").on(table.payDate),
		index("idx_payroll_periods_year").on(table.periodYear),
		check(
			"payroll_periods_period_month_range",
			sql`${table.periodMonth} >= 1 and ${table.periodMonth} <= 12`
		),
		check(
			"payroll_periods_period_year_range",
			sql`${table.periodYear} >= 2020 and ${table.periodYear} <= 2100`
		),
		check("payroll_periods_period_dates_order", sql`${table.periodEnd} >= ${table.periodStart}`),
	]
);

export const overtimeRecords = pgTable(
	"overtime_records",
	{
		id: varchar("id")
			.primaryKey()
			.$defaultFn(() => nanoid()),
		employeeId: varchar("employee_id", { length: 255 })
			.notNull()
			.references(() => employees.id, { onDelete: "cascade" }),
		payrollPeriodId: varchar("payroll_period_id", { length: 255 }).references(
			() => payrollPeriods.id,
			{ onDelete: "set null" }
		),
		periodMonth: integer("period_month").notNull(),
		periodYear: integer("period_year").notNull(),
		weekdayOvertimeHours: numeric("weekday_overtime_hours", {
			precision: 6,
			scale: 2,
		})
			.notNull()
			.default("0"),
		weekendOvertimeHours: numeric("weekend_overtime_hours", {
			precision: 6,
			scale: 2,
		})
			.notNull()
			.default("0"),
		publicHolidayOvertimeHours: numeric("public_holiday_overtime_hours", {
			precision: 6,
			scale: 2,
		})
			.notNull()
			.default("0"),
		overtimeHourlyRate: numeric("overtime_hourly_rate", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		weekdayOvertimePay: numeric("weekday_overtime_pay", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		weekendOvertimePay: numeric("weekend_overtime_pay", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		publicHolidayOvertimePay: numeric("public_holiday_overtime_pay", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		totalOvertimePay: numeric("total_overtime_pay", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		status: overtimeStatusEnum("status").notNull().default("draft"),
		approvedBy: varchar("approved_by", { length: 255 }).references(() => users.id, {
			onDelete: "set null",
		}),
		approvedAt: timestamp("approved_at", { withTimezone: true }),
		payrollSlipId: varchar("payroll_slip_id", { length: 255 }),
		notes: text("notes"),
		createdBy: varchar("created_by", { length: 255 }).references(() => users.id, {
			onDelete: "set null",
		}),
		createdAt,
		updatedAt,
	},
	(table) => [
		index("idx_overtime_records_employee_period").on(
			table.employeeId,
			table.periodYear,
			table.periodMonth
		),
		index("idx_overtime_records_period_status").on(
			table.periodYear,
			table.periodMonth,
			table.status
		),
		index("idx_overtime_records_payroll_slip_id").on(table.payrollSlipId),
		uniqueIndex("uq_overtime_records_employee_period").on(
			table.employeeId,
			table.periodYear,
			table.periodMonth
		),
		check(
			"overtime_records_period_month_range",
			sql`${table.periodMonth} >= 1 and ${table.periodMonth} <= 12`
		),
		check(
			"overtime_records_period_year_range",
			sql`${table.periodYear} >= 2000 and ${table.periodYear} <= 2100`
		),
	]
);

export const employeeLoans = pgTable(
	"employee_loans",
	{
		id: varchar("id", { length: 255 })
			.primaryKey()
			.$defaultFn(() => nanoid()),
		employeeId: varchar("employee_id", { length: 255 })
			.notNull()
			.references(() => employees.id, { onDelete: "cascade" }),
		applicationDate: date("application_date")
			.notNull()
			.default(sql`CURRENT_DATE`),
		principalAmount: numeric("principal_amount", {
			precision: 14,
			scale: 2,
		}).notNull(),
		annualInterestRate: numeric("annual_interest_rate", {
			precision: 7,
			scale: 4,
		})
			.notNull()
			.default("0"),
		requestedInstalments: integer("requested_instalments").notNull(),
		purpose: text("purpose"),
		status: loanStatusEnum("status").notNull().default("pending"),
		approvedBy: varchar("approved_by", { length: 255 }).references(() => users.id, {
			onDelete: "set null",
		}),
		approvedAt: timestamp("approved_at", { withTimezone: true }),
		approvedAmount: numeric("approved_amount", {
			precision: 14,
			scale: 2,
		}),
		approvedInstalments: integer("approved_instalments"),
		disbursementAccountId: integer("disbursement_account_id").references(() => ledgerAccounts.id, {
			onDelete: "set null",
		}),
		disbursementDate: date("disbursement_date"),
		repaymentStartMonth: integer("repayment_start_month"),
		repaymentStartYear: integer("repayment_start_year"),
		monthlyInstalment: numeric("monthly_instalment", {
			precision: 14,
			scale: 2,
		}),
		disbursementJournalEntryId: integer("disbursement_journal_entry_id").references(
			() => journalEntries.id,
			{
				onDelete: "set null",
			}
		),
		rejectedBy: varchar("rejected_by", { length: 255 }).references(() => users.id, {
			onDelete: "set null",
		}),
		rejectedAt: timestamp("rejected_at", { withTimezone: true }),
		rejectionReason: text("rejection_reason"),
		outstandingBalance: numeric("outstanding_balance", {
			precision: 14,
			scale: 2,
		}),
		totalPrincipalPaid: numeric("total_principal_paid", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		totalInterestPaid: numeric("total_interest_paid", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		instalmentsPaid: integer("instalments_paid").notNull().default(0),
		pausedBy: varchar("paused_by", { length: 255 }).references(() => users.id, {
			onDelete: "set null",
		}),
		pausedAt: timestamp("paused_at", { withTimezone: true }),
		resumedBy: varchar("resumed_by", { length: 255 }).references(() => users.id, {
			onDelete: "set null",
		}),
		resumedAt: timestamp("resumed_at", { withTimezone: true }),
		settledDate: date("settled_date"),
		settlementJournalEntryId: integer("settlement_journal_entry_id").references(
			() => journalEntries.id,
			{
				onDelete: "set null",
			}
		),
		notes: text("notes"),
		createdAt,
		updatedAt,
	},
	(table) => [
		index("idx_employee_loans_employee_id").on(table.employeeId),
		index("idx_employee_loans_employee_status").on(table.employeeId, table.status),
		index("idx_employee_loans_disbursement_account_id").on(table.disbursementAccountId),
		check(
			"employee_loans_requested_instalments_range",
			sql`${table.requestedInstalments} >= 1 and ${table.requestedInstalments} <= 60`
		),
		check(
			"employee_loans_approved_instalments_range",
			sql`${table.approvedInstalments} is null or (${table.approvedInstalments} >= 1 and ${table.approvedInstalments} <= 60)`
		),
		check(
			"employee_loans_interest_rate_range",
			sql`${table.annualInterestRate} >= 0 and ${table.annualInterestRate} <= 1`
		),
		check(
			"employee_loans_repayment_start_month_range",
			sql`${table.repaymentStartMonth} is null or (${table.repaymentStartMonth} >= 1 and ${table.repaymentStartMonth} <= 12)`
		),
		check(
			"employee_loans_repayment_start_year_range",
			sql`${table.repaymentStartYear} is null or (${table.repaymentStartYear} >= 2000 and ${table.repaymentStartYear} <= 2100)`
		),
	]
);

export const loanRepayments = pgTable(
	"loan_repayments",
	{
		id: varchar("id", { length: 255 })
			.primaryKey()
			.$defaultFn(() => nanoid()),
		loanId: varchar("loan_id", { length: 255 })
			.notNull()
			.references(() => employeeLoans.id, { onDelete: "cascade" }),
		employeeId: varchar("employee_id", { length: 255 })
			.notNull()
			.references(() => employees.id, { onDelete: "cascade" }),
		repaymentDate: date("repayment_date").notNull(),
		periodMonth: integer("period_month").notNull(),
		periodYear: integer("period_year").notNull(),
		principalComponent: numeric("principal_component", {
			precision: 14,
			scale: 2,
		}).notNull(),
		interestComponent: numeric("interest_component", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		totalRepayment: numeric("total_repayment", {
			precision: 14,
			scale: 2,
		}).notNull(),
		balanceBefore: numeric("balance_before", {
			precision: 14,
			scale: 2,
		}).notNull(),
		balanceAfter: numeric("balance_after", {
			precision: 14,
			scale: 2,
		}).notNull(),
		isEarlySettlement: boolean("is_early_settlement").notNull().default(false),
		payrollSlipId: varchar("payroll_slip_id", { length: 255 }).references(() => payrollSlips.id),
		journalEntryId: integer("journal_entry_id").references(() => journalEntries.id, {
			onDelete: "set null",
		}),
		notes: text("notes"),
		createdAt,
	},
	(table) => [
		index("idx_loan_repayments_loan_id").on(table.loanId),
		index("idx_loan_repayments_employee_period").on(
			table.employeeId,
			table.periodYear,
			table.periodMonth
		),
		index("idx_loan_repayments_payroll_slip_id").on(table.payrollSlipId),
		check(
			"loan_repayments_period_month_range",
			sql`${table.periodMonth} >= 1 and ${table.periodMonth} <= 12`
		),
		check(
			"loan_repayments_period_year_range",
			sql`${table.periodYear} >= 2000 and ${table.periodYear} <= 2100`
		),
	]
);

export const salaryAdvances = pgTable(
	"salary_advances",
	{
		id: varchar("id", { length: 255 })
			.primaryKey()
			.$defaultFn(() => nanoid()),
		employeeId: varchar("employee_id", { length: 255 })
			.notNull()
			.references(() => employees.id, { onDelete: "cascade" }),
		applicationDate: date("application_date")
			.notNull()
			.default(sql`CURRENT_DATE`),
		requestedAmount: numeric("requested_amount", {
			precision: 14,
			scale: 2,
		}).notNull(),
		reason: text("reason"),
		status: salaryAdvanceStatusEnum("status").notNull().default("pending"),
		requestedRecoveryMonths: integer("requested_recovery_months").notNull().default(1),
		approvedBy: varchar("approved_by", { length: 255 }).references(() => users.id, {
			onDelete: "set null",
		}),
		approvedAt: timestamp("approved_at", { withTimezone: true }),
		approvedAmount: numeric("approved_amount", {
			precision: 14,
			scale: 2,
		}),
		approvedRecoveryMonths: integer("approved_recovery_months"),
		monthlyRecoveryAmount: numeric("monthly_recovery_amount", {
			precision: 14,
			scale: 2,
		}),
		disbursementAccountId: integer("disbursement_account_id").references(() => ledgerAccounts.id, {
			onDelete: "set null",
		}),
		disbursementDate: date("disbursement_date"),
		disbursementJournalEntryId: integer("disbursement_journal_entry_id").references(
			() => journalEntries.id,
			{
				onDelete: "set null",
			}
		),
		recoveryStartMonth: integer("recovery_start_month"),
		recoveryStartYear: integer("recovery_start_year"),
		rejectedBy: varchar("rejected_by", { length: 255 }).references(() => users.id, {
			onDelete: "set null",
		}),
		rejectedAt: timestamp("rejected_at", { withTimezone: true }),
		rejectionReason: text("rejection_reason"),
		cancelledBy: varchar("cancelled_by", { length: 255 }).references(() => users.id, {
			onDelete: "set null",
		}),
		cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
		cancellationReason: text("cancellation_reason"),
		outstandingBalance: numeric("outstanding_balance", {
			precision: 14,
			scale: 2,
		}),
		totalRecovered: numeric("total_recovered", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		recoveriesProcessed: integer("recoveries_processed").notNull().default(0),
		notes: text("notes"),
		createdAt,
		updatedAt,
	},
	(table) => [
		index("idx_salary_advances_employee_id").on(table.employeeId),
		index("idx_salary_advances_employee_status").on(table.employeeId, table.status),
		index("idx_salary_advances_disbursement_account_id").on(table.disbursementAccountId),
		index("idx_salary_advances_status").on(table.status),
		check(
			"salary_advances_requested_recovery_months_range",
			sql`${table.requestedRecoveryMonths} >= 1 and ${table.requestedRecoveryMonths} <= 3`
		),
		check(
			"salary_advances_approved_recovery_months_range",
			sql`${table.approvedRecoveryMonths} is null or (${table.approvedRecoveryMonths} >= 1 and ${table.approvedRecoveryMonths} <= 3)`
		),
		check(
			"salary_advances_recovery_start_month_range",
			sql`${table.recoveryStartMonth} is null or (${table.recoveryStartMonth} >= 1 and ${table.recoveryStartMonth} <= 12)`
		),
		check(
			"salary_advances_recovery_start_year_range",
			sql`${table.recoveryStartYear} is null or (${table.recoveryStartYear} >= 2020 and ${table.recoveryStartYear} <= 2100)`
		),
	]
);

export const salaryAdvanceRecoveries = pgTable(
	"salary_advance_recoveries",
	{
		id: varchar("id", { length: 255 })
			.primaryKey()
			.$defaultFn(() => nanoid()),
		advanceId: varchar("advance_id", { length: 255 })
			.notNull()
			.references(() => salaryAdvances.id, { onDelete: "cascade" }),
		employeeId: varchar("employee_id", { length: 255 })
			.notNull()
			.references(() => employees.id, { onDelete: "cascade" }),
		recoveryDate: date("recovery_date").notNull(),
		periodMonth: integer("period_month").notNull(),
		periodYear: integer("period_year").notNull(),
		recoveryAmount: numeric("recovery_amount", {
			precision: 14,
			scale: 2,
		}).notNull(),
		balanceBefore: numeric("balance_before", {
			precision: 14,
			scale: 2,
		}).notNull(),
		balanceAfter: numeric("balance_after", {
			precision: 14,
			scale: 2,
		}).notNull(),
		isLastRecovery: boolean("is_last_recovery").notNull().default(false),
		payrollSlipId: varchar("payroll_slip_id", { length: 255 }).references(() => payrollSlips.id),
		clearingJournalEntryId: integer("clearing_journal_entry_id").references(
			() => journalEntries.id,
			{
				onDelete: "set null",
			}
		),
		notes: text("notes"),
		createdAt,
	},
	(table) => [
		index("idx_salary_advance_recoveries_advance_id").on(table.advanceId),
		index("idx_salary_advance_recoveries_employee_period").on(
			table.employeeId,
			table.periodYear,
			table.periodMonth
		),
		index("idx_salary_advance_recoveries_payroll_slip_id").on(table.payrollSlipId),
		uniqueIndex("uq_salary_advance_recoveries_advance_period").on(
			table.advanceId,
			table.periodYear,
			table.periodMonth
		),
		check(
			"salary_advance_recoveries_period_month_range",
			sql`${table.periodMonth} >= 1 and ${table.periodMonth} <= 12`
		),
		check(
			"salary_advance_recoveries_period_year_range",
			sql`${table.periodYear} >= 2020 and ${table.periodYear} <= 2100`
		),
	]
);

export const payrollPeriodBonuses = pgTable(
	"payroll_period_bonuses",
	{
		id: varchar("id", { length: 255 })
			.primaryKey()
			.$defaultFn(() => nanoid()),
		payrollPeriodId: varchar("payroll_period_id", { length: 255 })
			.notNull()
			.references(() => payrollPeriods.id, { onDelete: "cascade" }),
		employeeId: varchar("employee_id", { length: 255 })
			.notNull()
			.references(() => employees.id, { onDelete: "cascade" }),
		amount: numeric("amount", {
			precision: 14,
			scale: 2,
		}).notNull(),
		description: varchar("description", { length: 255 }).notNull(),
		notes: text("notes"),
		createdBy: varchar("created_by", { length: 255 }).references(() => users.id, {
			onDelete: "set null",
		}),
		createdAt,
		updatedAt,
	},
	(table) => [
		index("idx_payroll_period_bonuses_period").on(table.payrollPeriodId),
		index("idx_payroll_period_bonuses_employee").on(table.employeeId),
		index("idx_payroll_period_bonuses_period_employee").on(table.payrollPeriodId, table.employeeId),
	]
);

export const payrollPeriodOtherDeductions = pgTable(
	"payroll_period_other_deductions",
	{
		id: varchar("id", { length: 255 })
			.primaryKey()
			.$defaultFn(() => nanoid()),
		payrollPeriodId: varchar("payroll_period_id", { length: 255 })
			.notNull()
			.references(() => payrollPeriods.id, { onDelete: "cascade" }),
		employeeId: varchar("employee_id", { length: 255 })
			.notNull()
			.references(() => employees.id, { onDelete: "cascade" }),
		deductionType: payrollDeductionTypeEnum("deduction_type").notNull(),
		description: varchar("description", { length: 255 }).notNull(),
		amount: numeric("amount", {
			precision: 14,
			scale: 2,
		}).notNull(),
		notes: text("notes"),
		createdBy: varchar("created_by", { length: 255 }).references(() => users.id, {
			onDelete: "set null",
		}),
		createdAt,
		updatedAt,
	},
	(table) => [
		index("idx_payroll_period_other_deductions_period").on(table.payrollPeriodId),
		index("idx_payroll_period_other_deductions_employee").on(table.employeeId),
		index("idx_payroll_period_other_deductions_type").on(table.deductionType),
		check(
			"payroll_period_other_deductions_allowed_types",
			sql`${table.deductionType} not in ('company_loan', 'salary_advance', 'helb')`
		),
	]
);

export const payrollSlips = pgTable(
	"payroll_slips",
	{
		id: varchar("id", { length: 255 })
			.primaryKey()
			.$defaultFn(() => nanoid()),
		payrollPeriodId: varchar("payroll_period_id", { length: 255 })
			.notNull()
			.references(() => payrollPeriods.id, { onDelete: "cascade" }),
		employeeId: varchar("employee_id", { length: 255 })
			.notNull()
			.references(() => employees.id, { onDelete: "cascade" }),
		salaryStructureId: varchar("salary_structure_id", { length: 255 })
			.notNull()
			.references(() => salaryStructures.id, { onDelete: "restrict" }),
		status: payrollSlipStatusEnum("status").notNull().default("draft"),
		isProrated: boolean("is_prorated").notNull().default(false),
		proratedDays: integer("prorated_days"),
		totalWorkingDaysInPeriod: integer("total_working_days_in_period"),
		proratedReason: varchar("prorated_reason", { length: 50 }),
		basicSalary: numeric("basic_salary", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		houseAllowance: numeric("house_allowance", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		transportAllowance: numeric("transport_allowance", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		commuterAllowance: numeric("commuter_allowance", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		mealAllowance: numeric("meal_allowance", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		airtimeAllowance: numeric("airtime_allowance", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		otherAllowances: numeric("other_allowances", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		overtimePay: numeric("overtime_pay", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		bonuses: numeric("bonuses", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		grossPay: numeric("gross_pay", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		fullMonthGrossPay: numeric("full_month_gross_pay", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		overtimeRecordId: varchar("overtime_record_id", { length: 255 }).references(
			() => overtimeRecords.id,
			{ onDelete: "set null" }
		),
		weekdayOvertimeHours: numeric("weekday_overtime_hours", {
			precision: 6,
			scale: 2,
		}),
		weekendOvertimeHours: numeric("weekend_overtime_hours", {
			precision: 6,
			scale: 2,
		}),
		publicHolidayOvertimeHours: numeric("public_holiday_overtime_hours", {
			precision: 6,
			scale: 2,
		}),
		unpaidLeaveDays: integer("unpaid_leave_days").notNull().default(0),
		halfPayLeaveDays: integer("half_pay_leave_days").notNull().default(0),
		leaveDeductionAmount: numeric("leave_deduction_amount", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		nssfTier1Employee: numeric("nssf_tier_1_employee", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		nssfTier1Employer: numeric("nssf_tier_1_employer", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		nssfTier2Employee: numeric("nssf_tier_2_employee", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		nssfTier2Employer: numeric("nssf_tier_2_employer", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		nssfEmployee: numeric("nssf_employee", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		nssfEmployer: numeric("nssf_employer", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		shifEmployee: numeric("shif_employee", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		shifEmployer: numeric("shif_employer", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		ahlEmployee: numeric("ahl_employee", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		ahlEmployer: numeric("ahl_employer", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		nitaLevy: numeric("nita_levy", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("50"),
		pensionAllowableDeduction: numeric("pension_allowable_deduction", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		mortgageAllowableDeduction: numeric("mortgage_allowable_deduction", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		postRetirementAllowableDeduction: numeric("post_retirement_allowable_deduction", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		mealAllowanceExempt: numeric("meal_allowance_exempt", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		nonCashBenefitExempt: numeric("non_cash_benefit_exempt", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		taxableIncome: numeric("taxable_income", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		grossTax: numeric("gross_tax", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		personalRelief: numeric("personal_relief", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		insuranceRelief: numeric("insurance_relief", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		netPaye: numeric("net_paye", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		payeBandBreakdown: text("paye_band_breakdown"),
		pensionEmployeeDeduction: numeric("pension_employee_deduction", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		pensionEmployerContribution: numeric("pension_employer_contribution", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		totalEmployerCost: numeric("total_employer_cost", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		totalLoanDeductions: numeric("total_loan_deductions", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		totalAdvanceRecoveries: numeric("total_advance_recoveries", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		totalOtherDeductions: numeric("total_other_deductions", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		helbDeduction: numeric("helb_deduction", {
			precision: 14,
			scale: 2,
		})
			.notNull()
			.default("0"),
		totalStatutoryDeductions: numeric("total_statutory_deductions", {
			precision: 14,
			scale: 2,
		}).notNull(),
		totalVoluntaryDeductions: numeric("total_voluntary_deductions", {
			precision: 14,
			scale: 2,
		}).notNull(),
		totalDeductions: numeric("total_deductions", {
			precision: 14,
			scale: 2,
		}).notNull(),
		netPay: numeric("net_pay", {
			precision: 14,
			scale: 2,
		}).notNull(),
		twoThirdsCapApplied: boolean("two_thirds_cap_applied").notNull().default(false),
		twoThirdsCapAmount: numeric("two_thirds_cap_amount", {
			precision: 14,
			scale: 2,
		}),
		notes: text("notes"),
		approvedBy: varchar("approved_by", { length: 255 }).references(() => users.id, {
			onDelete: "set null",
		}),
		approvedAt: timestamp("approved_at", { withTimezone: true }),
		cancelledBy: varchar("cancelled_by", { length: 255 }).references(() => users.id, {
			onDelete: "set null",
		}),
		cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
		cancellationReason: text("cancellation_reason"),
		createdAt,
		updatedAt,
	},
	(table) => [
		uniqueIndex("uq_payroll_slips_period_employee").on(table.payrollPeriodId, table.employeeId),
		index("idx_payroll_slips_period").on(table.payrollPeriodId),
		index("idx_payroll_slips_employee").on(table.employeeId),
		index("idx_payroll_slips_overtime_record").on(table.overtimeRecordId),
	]
);

export const payrollDeductions = pgTable(
	"payroll_deductions",
	{
		id: varchar("id", { length: 255 })
			.primaryKey()
			.$defaultFn(() => nanoid()),
		payrollSlipId: varchar("payroll_slip_id", { length: 255 })
			.notNull()
			.references(() => payrollSlips.id, { onDelete: "cascade" }),
		payrollPeriodId: varchar("payroll_period_id", { length: 255 })
			.notNull()
			.references(() => payrollPeriods.id, { onDelete: "cascade" }),
		employeeId: varchar("employee_id", { length: 255 })
			.notNull()
			.references(() => employees.id, { onDelete: "cascade" }),
		deductionType: payrollDeductionTypeEnum("deduction_type").notNull(),
		description: varchar("description", { length: 255 }).notNull(),
		amount: numeric("amount", {
			precision: 14,
			scale: 2,
		}).notNull(),
		loanId: varchar("loan_id", { length: 255 }).references(() => employeeLoans.id, {
			onDelete: "set null",
		}),
		advanceId: varchar("advance_id", { length: 255 }).references(() => salaryAdvances.id, {
			onDelete: "set null",
		}),
		createdAt,
	},
	(table) => [
		index("idx_payroll_deductions_slip").on(table.payrollSlipId),
		index("idx_payroll_deductions_period_type").on(table.payrollPeriodId, table.deductionType),
		index("idx_payroll_deductions_loan").on(table.loanId),
		index("idx_payroll_deductions_advance").on(table.advanceId),
	]
);

export const payrollAccountMappings = pgTable(
	"payroll_account_mappings",
	{
		id: serial("id").primaryKey(),
		role: payrollAccountRoleEnum("role").notNull().unique(),
		accountId: integer("account_id")
			.notNull()
			.references(() => ledgerAccounts.id),
		description: text("description"),
		createdAt,
		updatedAt,
	},
	(table) => [index("idx_payroll_account_mappings_role").on(table.role)]
);

export const statutoryRates = pgTable(
	"statutory_rates",
	{
		id: varchar("id", { length: 255 })
			.primaryKey()
			.$defaultFn(() => nanoid()),
		category: statutoryRateCategoryEnum("category").notNull(),
		label: varchar("label", { length: 100 }).notNull(),
		effectiveFrom: date("effective_from").notNull(),
		effectiveTo: date("effective_to"),
		lowerBound: numeric("lower_bound", {
			precision: 14,
			scale: 2,
		}),
		upperBound: numeric("upper_bound", {
			precision: 14,
			scale: 2,
		}),
		rate: numeric("rate", {
			precision: 10,
			scale: 6,
		}),
		fixedAmount: numeric("fixed_amount", {
			precision: 14,
			scale: 2,
		}),
		notes: text("notes"),
		createdBy: varchar("created_by", { length: 255 }).references(() => users.id, {
			onDelete: "set null",
		}),
		createdAt,
		updatedAt,
	},
	(table) => [
		index("idx_statutory_rates_category_effective_from").on(table.category, table.effectiveFrom),
		index("idx_statutory_rates_category_effective_to").on(table.category, table.effectiveTo),
		index("idx_statutory_rates_effective_from").on(table.effectiveFrom),
		check(
			"statutory_rates_effective_to_after_from",
			sql`${table.effectiveTo} is null or ${table.effectiveTo} > ${table.effectiveFrom}`
		),
	]
);

export const salaryStructuresRelations = relations(salaryStructures, ({ many, one }) => ({
	employee: one(employees, {
		fields: [salaryStructures.employeeId],
		references: [employees.id],
	}),
	createdByUser: one(users, {
		fields: [salaryStructures.createdBy],
		references: [users.id],
	}),
	payrollSlips: many(payrollSlips),
}));

export const payrollPeriodsRelations = relations(payrollPeriods, ({ many, one }) => ({
	createdByUser: one(users, {
		fields: [payrollPeriods.createdBy],
		references: [users.id],
	}),
	approvedByUser: one(users, {
		fields: [payrollPeriods.approvedBy],
		references: [users.id],
	}),
	cancelledByUser: one(users, {
		fields: [payrollPeriods.cancelledBy],
		references: [users.id],
	}),
	payrollJournalEntry: one(journalEntries, {
		fields: [payrollPeriods.payrollJournalEntryId],
		references: [journalEntries.id],
	}),
	disbursementJournalEntry: one(journalEntries, {
		fields: [payrollPeriods.disbursementJournalEntryId],
		references: [journalEntries.id],
	}),
	remittanceJournalEntry: one(journalEntries, {
		fields: [payrollPeriods.remittanceJournalEntryId],
		references: [journalEntries.id],
	}),
	overtimeRecords: many(overtimeRecords),
	payrollSlips: many(payrollSlips),
	payrollDeductions: many(payrollDeductions),
	bonuses: many(payrollPeriodBonuses),
	otherDeductions: many(payrollPeriodOtherDeductions),
}));

export const overtimeRecordsRelations = relations(overtimeRecords, ({ one }) => ({
	employee: one(employees, {
		fields: [overtimeRecords.employeeId],
		references: [employees.id],
	}),
	payrollPeriod: one(payrollPeriods, {
		fields: [overtimeRecords.payrollPeriodId],
		references: [payrollPeriods.id],
	}),
	createdByUser: one(users, {
		fields: [overtimeRecords.createdBy],
		references: [users.id],
	}),
	approvedByUser: one(users, {
		fields: [overtimeRecords.approvedBy],
		references: [users.id],
	}),
	payrollSlip: one(payrollSlips, {
		fields: [overtimeRecords.payrollSlipId],
		references: [payrollSlips.id],
	}),
}));

export const employeeLoansRelations = relations(employeeLoans, ({ many, one }) => ({
	employee: one(employees, {
		fields: [employeeLoans.employeeId],
		references: [employees.id],
	}),
	approvedByUser: one(users, {
		fields: [employeeLoans.approvedBy],
		references: [users.id],
	}),
	rejectedByUser: one(users, {
		fields: [employeeLoans.rejectedBy],
		references: [users.id],
	}),
	pausedByUser: one(users, {
		fields: [employeeLoans.pausedBy],
		references: [users.id],
	}),
	resumedByUser: one(users, {
		fields: [employeeLoans.resumedBy],
		references: [users.id],
	}),
	disbursementAccount: one(ledgerAccounts, {
		fields: [employeeLoans.disbursementAccountId],
		references: [ledgerAccounts.id],
	}),
	disbursementJournalEntry: one(journalEntries, {
		fields: [employeeLoans.disbursementJournalEntryId],
		references: [journalEntries.id],
	}),
	settlementJournalEntry: one(journalEntries, {
		fields: [employeeLoans.settlementJournalEntryId],
		references: [journalEntries.id],
	}),
	repayments: many(loanRepayments),
	payrollDeductions: many(payrollDeductions),
}));

export const loanRepaymentsRelations = relations(loanRepayments, ({ one }) => ({
	loan: one(employeeLoans, {
		fields: [loanRepayments.loanId],
		references: [employeeLoans.id],
	}),
	employee: one(employees, {
		fields: [loanRepayments.employeeId],
		references: [employees.id],
	}),
	journalEntry: one(journalEntries, {
		fields: [loanRepayments.journalEntryId],
		references: [journalEntries.id],
	}),
	payrollSlip: one(payrollSlips, {
		fields: [loanRepayments.payrollSlipId],
		references: [payrollSlips.id],
	}),
}));

export const salaryAdvancesRelations = relations(salaryAdvances, ({ many, one }) => ({
	employee: one(employees, {
		fields: [salaryAdvances.employeeId],
		references: [employees.id],
	}),
	approvedByUser: one(users, {
		fields: [salaryAdvances.approvedBy],
		references: [users.id],
	}),
	rejectedByUser: one(users, {
		fields: [salaryAdvances.rejectedBy],
		references: [users.id],
	}),
	cancelledByUser: one(users, {
		fields: [salaryAdvances.cancelledBy],
		references: [users.id],
	}),
	disbursementAccount: one(ledgerAccounts, {
		fields: [salaryAdvances.disbursementAccountId],
		references: [ledgerAccounts.id],
	}),
	disbursementJournalEntry: one(journalEntries, {
		fields: [salaryAdvances.disbursementJournalEntryId],
		references: [journalEntries.id],
	}),
	recoveries: many(salaryAdvanceRecoveries),
	payrollDeductions: many(payrollDeductions),
}));

export const salaryAdvanceRecoveriesRelations = relations(salaryAdvanceRecoveries, ({ one }) => ({
	advance: one(salaryAdvances, {
		fields: [salaryAdvanceRecoveries.advanceId],
		references: [salaryAdvances.id],
	}),
	employee: one(employees, {
		fields: [salaryAdvanceRecoveries.employeeId],
		references: [employees.id],
	}),
	clearingJournalEntry: one(journalEntries, {
		fields: [salaryAdvanceRecoveries.clearingJournalEntryId],
		references: [journalEntries.id],
	}),
	payrollSlip: one(payrollSlips, {
		fields: [salaryAdvanceRecoveries.payrollSlipId],
		references: [payrollSlips.id],
	}),
}));

export const payrollPeriodBonusesRelations = relations(payrollPeriodBonuses, ({ one }) => ({
	payrollPeriod: one(payrollPeriods, {
		fields: [payrollPeriodBonuses.payrollPeriodId],
		references: [payrollPeriods.id],
	}),
	employee: one(employees, {
		fields: [payrollPeriodBonuses.employeeId],
		references: [employees.id],
	}),
	createdByUser: one(users, {
		fields: [payrollPeriodBonuses.createdBy],
		references: [users.id],
	}),
}));

export const payrollPeriodOtherDeductionsRelations = relations(
	payrollPeriodOtherDeductions,
	({ one }) => ({
		payrollPeriod: one(payrollPeriods, {
			fields: [payrollPeriodOtherDeductions.payrollPeriodId],
			references: [payrollPeriods.id],
		}),
		employee: one(employees, {
			fields: [payrollPeriodOtherDeductions.employeeId],
			references: [employees.id],
		}),
		createdByUser: one(users, {
			fields: [payrollPeriodOtherDeductions.createdBy],
			references: [users.id],
		}),
	})
);

export const payrollSlipsRelations = relations(payrollSlips, ({ many, one }) => ({
	payrollPeriod: one(payrollPeriods, {
		fields: [payrollSlips.payrollPeriodId],
		references: [payrollPeriods.id],
	}),
	employee: one(employees, {
		fields: [payrollSlips.employeeId],
		references: [employees.id],
	}),
	salaryStructure: one(salaryStructures, {
		fields: [payrollSlips.salaryStructureId],
		references: [salaryStructures.id],
	}),
	overtimeRecord: one(overtimeRecords, {
		fields: [payrollSlips.overtimeRecordId],
		references: [overtimeRecords.id],
	}),
	approvedByUser: one(users, {
		fields: [payrollSlips.approvedBy],
		references: [users.id],
	}),
	cancelledByUser: one(users, {
		fields: [payrollSlips.cancelledBy],
		references: [users.id],
	}),
	deductions: many(payrollDeductions),
	loanRepayments: many(loanRepayments),
	advanceRecoveries: many(salaryAdvanceRecoveries),
}));

export const payrollDeductionsRelations = relations(payrollDeductions, ({ one }) => ({
	payrollSlip: one(payrollSlips, {
		fields: [payrollDeductions.payrollSlipId],
		references: [payrollSlips.id],
	}),
	payrollPeriod: one(payrollPeriods, {
		fields: [payrollDeductions.payrollPeriodId],
		references: [payrollPeriods.id],
	}),
	employee: one(employees, {
		fields: [payrollDeductions.employeeId],
		references: [employees.id],
	}),
	loan: one(employeeLoans, {
		fields: [payrollDeductions.loanId],
		references: [employeeLoans.id],
	}),
	advance: one(salaryAdvances, {
		fields: [payrollDeductions.advanceId],
		references: [salaryAdvances.id],
	}),
}));

export const payrollAccountMappingsRelations = relations(payrollAccountMappings, ({ one }) => ({
	account: one(ledgerAccounts, {
		fields: [payrollAccountMappings.accountId],
		references: [ledgerAccounts.id],
	}),
}));
