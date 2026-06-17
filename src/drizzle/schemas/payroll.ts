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
	STATUTORY_RATE_CATEGORIES,
	type StatutoryRateCategory,
	type PayrollAccountRole,
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
const statutoryRateCategoryValues = STATUTORY_RATE_CATEGORIES as unknown as [
	StatutoryRateCategory,
	...Array<StatutoryRateCategory>,
];
export const OVERTIME_STATUSES = ["draft", "approved", "paid"] as const;
export type OvertimeStatus = (typeof OVERTIME_STATUSES)[number];
const loanStatusValues = Object.values(LOAN_STATUS) as [string & {}, ...(string & {})[]];
export type LoanStatus = (typeof loanStatusValues)[number];

export const payrollAccountRoleEnum = pgEnum("payroll_account_role", payrollAccountRoleValues);
export const statutoryRateCategoryEnum = pgEnum(
	"statutory_rate_category",
	statutoryRateCategoryValues
);
export const overtimeStatusEnum = pgEnum("overtime_status", OVERTIME_STATUSES);
export const loanStatusEnum = pgEnum("loan_status", loanStatusValues);

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

export const overtimeRecords = pgTable(
	"overtime_records",
	{
		id: varchar("id")
			.primaryKey()
			.$defaultFn(() => nanoid()),
		employeeId: varchar("employee_id", { length: 255 })
			.notNull()
			.references(() => employees.id, { onDelete: "cascade" }),
		payrollPeriodId: varchar("payroll_period_id", { length: 255 }),
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
		// FK to payroll_slips.id — constraint added in payroll calculation engine migration.
		payrollSlipId: varchar("payroll_slip_id", { length: 255 }),
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

export const salaryStructuresRelations = relations(salaryStructures, ({ one }) => ({
	employee: one(employees, {
		fields: [salaryStructures.employeeId],
		references: [employees.id],
	}),
	createdByUser: one(users, {
		fields: [salaryStructures.createdBy],
		references: [users.id],
	}),
}));

export const overtimeRecordsRelations = relations(overtimeRecords, ({ one }) => ({
	employee: one(employees, {
		fields: [overtimeRecords.employeeId],
		references: [employees.id],
	}),
	createdByUser: one(users, {
		fields: [overtimeRecords.createdBy],
		references: [users.id],
	}),
	approvedByUser: one(users, {
		fields: [overtimeRecords.approvedBy],
		references: [users.id],
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
}));

export const payrollAccountMappingsRelations = relations(payrollAccountMappings, ({ one }) => ({
	account: one(ledgerAccounts, {
		fields: [payrollAccountMappings.accountId],
		references: [ledgerAccounts.id],
	}),
}));
