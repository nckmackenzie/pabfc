import { relations } from "drizzle-orm";
import {
	boolean,
	date,
	decimal,
	index,
	integer,
	pgEnum,
	pgTable,
	serial,
	text,
	varchar,
} from "drizzle-orm/pg-core";
import { active, createdAt, id, updatedAt } from "@/drizzle/schema-helpers";
import { users } from "@/drizzle/schemas/auth";
import {
	ledgerAccounts,
	lineDcEnum,
} from "@/drizzle/schemas/chart-of-accounts";
import { vatTypeEnum } from "@/drizzle/schemas/settings";

export const vendors = pgTable(
	"vendors",
	{
		id,
		name: varchar("name").notNull(),
		email: varchar("email"),
		phone: varchar("phone"),
		address: varchar("address"),
		taxPin: varchar("tax_pin").unique(),
		active,
		createdAt,
	},
	(table) => [
		index("idx_vendors_name").on(table.name),
		index("idx_vendors_tax_pin").on(table.taxPin),
		index("idx_vendors_email").on(table.email),
		index("idx_vendors_phone").on(table.phone),
	],
);
export const BILL_STATUS = [
	"draft",
	"pending",
	"approved",
	"paid",
	"overdue",
	"cancelled",
] as const;
export const billStatusEnum = pgEnum("bill_status", BILL_STATUS);
export const RECURRENCY_PERIOD = [
	"daily",
	"weekly",
	"monthly",
	"quarterly",
	"biannually",
	"yearly",
] as const;
export const recurrencyPeriodEnum = pgEnum(
	"recurrency_period",
	RECURRENCY_PERIOD,
);

export const bills = pgTable(
	"bills",
	{
		id,
		vendorId: varchar("vendor_id")
			.notNull()
			.references(() => vendors.id),
		invoiceNo: varchar("invoice_no").notNull(),
		invoiceDate: date("invoice_date").notNull(),
		dueDate: date("due_date"),
		vatType: vatTypeEnum("vat_type").notNull().default("exclusive"),
		vatRate: decimal("vat_rate", { precision: 10, scale: 2 })
			.notNull()
			.default("16"),
		subTotal: decimal("sub_total", { precision: 10, scale: 2 }).notNull(),
		tax: decimal("tax", { precision: 10, scale: 2 }).notNull(),
		total: decimal("total", { precision: 10, scale: 2 }).notNull(),
		status: billStatusEnum("status").notNull().default("draft"),
		isRecurring: boolean("is_recurring").notNull().default(false),
		recurrencyPeriod: recurrencyPeriodEnum("recurrency_period"),
		recurrencyEndDate: date("recurrency_end_date"),
		memo: text("memo"),
		createdBy: varchar("created_by")
			.notNull()
			.references(() => users.id),
		createdAt,
		updatedAt,
	},
	(table) => [
		index("idx_bills_vendor_id").on(table.vendorId),
		index("idx_bills_invoice_no").on(table.invoiceNo),
		index("idx_bills_invoice_date").on(table.invoiceDate),
		index("idx_bills_due_date").on(table.dueDate),
		index("idx_bills_status").on(table.status),
	],
);

export const billsRelations = relations(bills, ({ many }) => ({
	items: many(billItems),
	payments: many(billPayments),
}));

export const billItems = pgTable(
	"bill_items",
	{
		id: serial("id").primaryKey(),
		billId: varchar("bill_id")
			.notNull()
			.references(() => bills.id),
		description: text("description").notNull(),
		quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
		unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
		taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).notNull(),
		total: decimal("total", { precision: 10, scale: 2 }).notNull(),
		expenseAccountId: integer("expense_account_id")
			.notNull()
			.references(() => ledgerAccounts.id),
		createdAt,
		updatedAt,
	},
	(table) => [index("idx_bill_items_bill_id").on(table.billId)],
);

export const billItemsRelations = relations(billItems, ({ one }) => ({
	bill: one(bills, {
		fields: [billItems.billId],
		references: [bills.id],
	}),
	expenseAccount: one(ledgerAccounts, {
		fields: [billItems.expenseAccountId],
		references: [ledgerAccounts.id],
	}),
}));

export const billPayments = pgTable(
	"bill_payments",
	{
		id,
		paymentNo: integer("payment_no").notNull(),
		paymentDate: date("payment_date").notNull(),
		paymentMethod: varchar("payment_method").notNull(),
		reference: varchar("reference"),
		memo: text("memo"),
		createdBy: varchar("created_by")
			.notNull()
			.references(() => users.id),
		createdAt,
		updatedAt,
	},
	(table) => [
		index("idx_bill_payments_payment_no").on(table.paymentNo),
		index("idx_bill_payments_payment_date").on(table.paymentDate),
		index("idx_bill_payments_reference").on(table.reference),
	],
);

export const billPaymentsRelations = relations(billPayments, ({ one }) => ({
	lines: one(billPaymentLines, {
		fields: [billPayments.id],
		references: [billPaymentLines.billPaymentId],
	}),
}));

export const billPaymentLines = pgTable(
	"bill_payment_lines",
	{
		id: serial("id").primaryKey(),
		lineNumber: integer("line_number").notNull(),
		billPaymentId: varchar("bill_payment_id")
			.notNull()
			.references(() => billPayments.id),
		vendorId: varchar("vendor_id")
			.notNull()
			.references(() => vendors.id),
		billId: varchar("bill_id")
			.notNull()
			.references(() => bills.id),
		amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
		dc: lineDcEnum("dc").notNull(),
	},
	(table) => [
		index("idx_bill_payment_lines_bill_payment_id").on(table.billPaymentId),
		index("idx_bill_payment_lines_vendor_id").on(table.vendorId),
		index("idx_bill_payment_lines_bill_id").on(table.billId),
	],
);

export const billPaymentLinesRelations = relations(
	billPaymentLines,
	({ one }) => ({
		billPayment: one(billPayments, {
			fields: [billPaymentLines.billPaymentId],
			references: [billPayments.id],
		}),
		vendor: one(vendors, {
			fields: [billPaymentLines.vendorId],
			references: [vendors.id],
		}),
		bill: one(bills, {
			fields: [billPaymentLines.billId],
			references: [bills.id],
		}),
	}),
);

export const recurringBillsSchedules = pgTable("recurring_bills_schedules", {
	id,
	vendorId: varchar("vendor_id")
		.notNull()
		.references(() => vendors.id),
	billId: varchar("bill_id")
		.notNull()
		.references(() => bills.id),
	recurrencyPeriod: recurrencyPeriodEnum("recurrency_period").notNull(),
	recurrencyEndDate: date("recurrency_end_date"),
	nextBillDate: date("next_bill_date"),
	lastGeneratedDate: date("last_generated_date"),
});
