import {
  boolean,
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
import { createdAt, id, updatedAt } from "@/drizzle/schema-helpers";
import { users } from "./auth";
import { employees } from "./employees";

export const LEAVE_TYPES = [
  "annual",
  "sick",
  "maternity",
  "paternity",
  "pre_adoptive",
  "compassionate",
  "study",
  "unpaid",
] as const;

export type LeaveType = (typeof LEAVE_TYPES)[number];

export const LEAVE_STATUS = ["pending", "approved", "rejected", "cancelled"] as const;

export const LEAVE_APPLICABLE_GENDERS = ["male", "female"] as const;

export const leaveTypeEnum = pgEnum("leave_type", LEAVE_TYPES);
export const leaveStatusEnum = pgEnum("leave_status", LEAVE_STATUS);
export const leaveApplicableGenderEnum = pgEnum(
  "leave_applicable_gender",
  LEAVE_APPLICABLE_GENDERS
);

export const leaveEntitlements = pgTable("leave_entitlements", {
  id: serial("id").primaryKey(),
  leaveType: leaveTypeEnum("leave_type").notNull().unique(),
  annualDaysEntitled: numeric("annual_days_entitled", {
    precision: 6,
    scale: 2,
  }).notNull(),
  accrualRatePerMonth: numeric("accrual_rate_per_month", {
    precision: 6,
    scale: 4,
  }),
  isPaid: boolean("is_paid").notNull().default(true),
  fullPayDays: numeric("full_pay_days", {
    precision: 6,
    scale: 2,
  })
    .notNull()
    .default("0"),
  halfPayDays: numeric("half_pay_days", {
    precision: 6,
    scale: 2,
  })
    .notNull()
    .default("0"),
  carryForwardAllowed: boolean("carry_forward_allowed").notNull().default(false),
  carryForwardCapDays: numeric("carry_forward_cap_days", {
    precision: 6,
    scale: 2,
  }),
  carryForwardExpiryMonths: integer("carry_forward_expiry_months"),
  minServiceMonthsRequired: integer("min_service_months_required").notNull().default(0),
  requiresMedicalCert: boolean("requires_medical_cert").notNull().default(false),
  applicableGender: leaveApplicableGenderEnum("applicable_gender"),
  isOneOffEntitlement: boolean("is_one_off_entitlement").notNull().default(false),
  description: text("description"),
  createdAt,
  updatedAt,
});

export const publicHolidays = pgTable(
  "public_holidays",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    holidayDate: date("holiday_date").notNull().unique(),
    createdAt,
    updatedAt,
  },
  (table) => [index("idx_public_holidays_date").on(table.holidayDate)]
);

export const employeeLeaveBalances = pgTable(
  "employee_leave_balances",
  {
    id: serial("id").primaryKey(),
    employeeId: varchar("employee_id", { length: 255 })
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    leaveType: leaveTypeEnum("leave_type").notNull(),
    leaveYear: integer("leave_year").notNull(),
    entitledDays: numeric("entitled_days", { precision: 6, scale: 2 }).notNull().default("0"),
    carriedForwardDays: numeric("carried_forward_days", {
      precision: 6,
      scale: 2,
    })
      .notNull()
      .default("0"),
    adjustmentDays: numeric("adjustment_days", { precision: 6, scale: 2 }).notNull().default("0"),
    takenDays: numeric("taken_days", { precision: 6, scale: 2 }).notNull().default("0"),
    carryForwardExpiresAt: timestamp("carry_forward_expires_at", {
      withTimezone: true,
    }),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("uq_employee_leave_balance_employee_type_year").on(
      table.employeeId,
      table.leaveType,
      table.leaveYear
    ),
    index("idx_employee_leave_balances_employee").on(table.employeeId),
    index("idx_employee_leave_balances_year").on(table.leaveYear),
  ]
);

export const leaveRequests = pgTable(
  "leave_requests",
  {
    id,
    employeeId: varchar("employee_id", { length: 255 })
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    leaveType: leaveTypeEnum("leave_type").notNull(),
    leaveYear: integer("leave_year").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    workingDaysRequested: numeric("working_days_requested", {
      precision: 6,
      scale: 2,
    }).notNull(),
    reason: text("reason"),
    status: leaveStatusEnum("status").notNull().default("pending"),
    requestedBy: varchar("requested_by", { length: 255 }).references(() => users.id, {
      onDelete: "set null",
    }),
    approvedBy: varchar("approved_by", { length: 255 }).references(() => users.id, {
      onDelete: "set null",
    }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),
    cancelledBy: varchar("cancelled_by", { length: 255 }).references(() => users.id, {
      onDelete: "set null",
    }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    medicalCertPath: varchar("medical_cert_path", { length: 500 }),
    medicalCertificateRequired: boolean("medical_certificate_required").notNull().default(false),
    affectsPayroll: boolean("affects_payroll").notNull().default(false),
    payrollImpactNotes: text("payroll_impact_notes"),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("idx_leave_requests_employee").on(table.employeeId),
    index("idx_leave_requests_status").on(table.status),
    index("idx_leave_requests_year").on(table.leaveYear),
    index("idx_leave_requests_dates").on(table.startDate, table.endDate),
  ]
);

export const leaveBalanceAdjustments = pgTable(
  "leave_balance_adjustments",
  {
    id: serial("id").primaryKey(),
    employeeId: varchar("employee_id", { length: 255 })
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    leaveType: leaveTypeEnum("leave_type").notNull(),
    leaveYear: integer("leave_year").notNull(),
    adjustmentDays: numeric("adjustment_days", {
      precision: 6,
      scale: 2,
    }).notNull(),
    reason: text("reason").notNull(),
    performedBy: varchar("performed_by", { length: 255 }).references(() => users.id, {
      onDelete: "set null",
    }),
    appliedToBalanceAdjustmentTotal: boolean("applied_to_balance_adjustment_total")
      .notNull()
      .default(true),
    warning: text("warning"),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("idx_leave_balance_adjustments_employee").on(table.employeeId),
    index("idx_leave_balance_adjustments_year").on(table.leaveYear),
  ]
);
