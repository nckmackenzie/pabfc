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
	varchar,
} from "drizzle-orm/pg-core";
import { createdAt, updatedAt } from "@/drizzle/schema-helpers";
import {
	PAYROLL_ACCOUNT_ROLE_KEYS,
	type PayrollAccountRole,
} from "@/features/payroll/lib/payroll-constants";
import { users } from "./auth";
import { ledgerAccounts } from "./chart-of-accounts";
import { employees } from "./employees";
import { nanoid } from "nanoid";

export const PAY_FREQUENCIES = ["monthly", "bi_weekly", "weekly"] as const;
export type PayFrequency = (typeof PAY_FREQUENCIES)[number];

export const payFrequencyEnum = pgEnum("pay_frequency", PAY_FREQUENCIES);
const payrollAccountRoleValues = PAYROLL_ACCOUNT_ROLE_KEYS as [
	PayrollAccountRole,
	...Array<PayrollAccountRole>,
];

export const payrollAccountRoleEnum = pgEnum(
	"payroll_account_role",
	payrollAccountRoleValues
);

export const salaryStructures = pgTable(
	"salary_structures",
	{
		id: varchar("id").primaryKey().$defaultFn(() => nanoid()),
		employeeId: varchar("employee_id", { length: 255 })
			.notNull()
			.references(() => employees.id, { onDelete: "cascade" }),
		effectiveFrom: date("effective_from").notNull(),
		effectiveTo: date("effective_to"),
		payFrequency: payFrequencyEnum("pay_frequency")
			.notNull()
			.default("monthly"),
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
		postRetirementMedicalMonthly: numeric(
			"post_retirement_medical_monthly",
			{
				precision: 14,
				scale: 2,
			},
		)
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
		overtimeHourlyRateDivisor: integer("overtime_hourly_rate_divisor")
			.notNull()
			.default(225),
		isActive: boolean("is_active").notNull().default(true),
		notes: text("notes"),
		createdBy: varchar("created_by", { length: 255 }).references(
			() => users.id,
			{
				onDelete: "set null",
			},
		),
		createdAt,
		updatedAt,
	},
	(table) => [
		index("idx_salary_structures_employee").on(table.employeeId),
		index("idx_salary_structures_employee_effective_from").on(
			table.employeeId,
			table.effectiveFrom,
		),
		index("idx_salary_structures_employee_effective_to").on(
			table.employeeId,
			table.effectiveTo,
		),
		index("idx_salary_structures_employee_active").on(
			table.employeeId,
			table.isActive,
		),
		check(
			"salary_structures_effective_to_after_from",
			sql`${table.effectiveTo} is null or ${table.effectiveTo} > ${table.effectiveFrom}`,
		),
	],
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

export const payrollAccountMappingsRelations = relations(
	payrollAccountMappings,
	({ one }) => ({
		account: one(ledgerAccounts, {
			fields: [payrollAccountMappings.accountId],
			references: [ledgerAccounts.id],
		}),
	})
);
