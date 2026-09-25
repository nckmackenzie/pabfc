import { relations } from "drizzle-orm";
import {
	boolean,
	date,
	decimal,
	index,
	integer,
	numeric,
	pgEnum,
	pgView,
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
import { bankAccounts } from "./bank";

export const BILL_STATUS = [
	"draft",
	"pending",
	"approved",
	"paid",
	"overdue",
	"cancelled",
	"partially-paid",
] as const;
export const billStatusEnum = pgEnum("bill_status", BILL_STATUS);

/**
 * The subset of BILL_STATUS that `vw_invoices.display_status` can actually
 * produce. `draft`, `approved` and `cancelled` belong to the bill approval
 * workflow, which nothing writes yet, so offering them as filters would only
 * ever return empty results.
 */
export const BILL_DISPLAY_STATUS = [
	"pending",
	"partially-paid",
	"paid",
	"overdue",
] as const satisfies ReadonlyArray<(typeof BILL_STATUS)[number]>;
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

/**
 * Nature of expense that a withholding tax deduction is made against. The
 * category selects a default rate (see `wht-constants.ts`); the rate stays
 * editable per line because it varies with the vendor's residency.
 */
export const WHT_CATEGORIES = [
	"professional_management_training_fee",
	"rent",
	"contractual_fee",
	"other",
] as const;
export const whtCategoryEnum = pgEnum("wht_category", WHT_CATEGORIES);

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

export const vendorRelations = relations(vendors, ({ many }) => ({
	bills: many(bills),
	payments: many(billPayments),
}));

export const bills = pgTable(
	"bills",
	{
		id,
		vendorId: varchar("vendor_id")
			.notNull()
			.references(() => vendors.id),
		invoiceNo: varchar("invoice_no").notNull().unique(),
		invoiceDate: date("invoice_date").notNull(),
		dueDate: date("due_date"),
		subTotal: decimal("sub_total", { precision: 10, scale: 2 }).notNull(),
		tax: decimal("tax", { precision: 10, scale: 2 }).notNull(),
		total: decimal("total", { precision: 10, scale: 2 }).notNull(),
		// Snapshot of the withheld tax summed from the bill's lines. The vendor is
		// owed `total - whtAmount`; the remainder is owed to KRA and is settled
		// through `wht_remittances`, not through a bill payment.
		whtAmount: decimal("wht_amount", { precision: 10, scale: 2 })
			.notNull()
			.default("0"),
		// Recorded after the withheld amount is remitted and iTax issues the
		// certificate, so both stay null on a freshly created bill.
		whtCertificateNo: varchar("wht_certificate_no"),
		whtCertificateIssuedDate: date("wht_certificate_issued_date"),
		status: billStatusEnum("status").notNull().default("draft"),
		isRecurring: boolean("is_recurring").notNull().default(false),
		recurrencyPeriod: recurrencyPeriodEnum("recurrency_period"),
		recurrencyEndDate: date("recurrency_end_date"),
		terms: varchar("terms"),
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

export const billsRelations = relations(bills, ({ one, many }) => ({
	items: many(billItems),
	payments: many(billPaymentLines),
	whtRemittances: many(whtRemittanceLines),
	vendor: one(vendors, {
		fields: [bills.vendorId],
		references: [vendors.id],
	}),
}));

export const billItems = pgTable(
	"bill_items",
	{
		id: serial("id").primaryKey(),
		billId: varchar("bill_id")
			.notNull()
			.references(() => bills.id),
		description: text("description"),
		quantity: decimal("quantity", { precision: 10, scale: 2 }),
		unitPrice: decimal("unit_price", { precision: 10, scale: 2 }),
		subTotal: decimal("sub_total", { precision: 10, scale: 2 }).notNull(),
		vatType: vatTypeEnum("vat_type").notNull().default("exclusive"),
		vatRate: decimal("vat_rate", { precision: 10, scale: 2 })
			.notNull()
			.default("16"),
		taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).notNull(),
		total: decimal("total", { precision: 10, scale: 2 }).notNull(),
		// Withholding tax mirrors the vatType/vatRate/taxAmount trio above: the
		// category and rate are inputs, `whtAmount` is the computed snapshot.
		whtApplicable: boolean("wht_applicable").notNull().default(false),
		whtCategory: whtCategoryEnum("wht_category"),
		whtRate: decimal("wht_rate", { precision: 5, scale: 2 }),
		whtAmount: decimal("wht_amount", { precision: 10, scale: 2 })
			.notNull()
			.default("0"),
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
		vendorId: varchar("vendor_id")
			.notNull()
			.references(() => vendors.id),
		reference: varchar("reference"),
		bankId: varchar("bank_id").references(() => bankAccounts.id),
		creditingAccountId: integer("crediting_account_id").references(
			() => ledgerAccounts.id,
		),
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

export const billPaymentsRelations = relations(
	billPayments,
	({ one, many }) => ({
		lines: many(billPaymentLines),
		vendor: one(vendors, {
			fields: [billPayments.vendorId],
			references: [vendors.id],
		}),
		bank: one(bankAccounts, {
			fields: [billPayments.bankId],
			references: [bankAccounts.id],
		}),
	}),
);

export const billPaymentLines = pgTable(
	"bill_payment_lines",
	{
		id: serial("id").primaryKey(),
		lineNumber: integer("line_number").notNull(),
		billPaymentId: varchar("bill_payment_id")
			.notNull()
			.references(() => billPayments.id, { onDelete: "cascade" }),
		billId: varchar("bill_id")
			.notNull()
			.references(() => bills.id),
		amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
		currentBalance: decimal("balance", { precision: 10, scale: 2 })
			.notNull()
			.default("0"),
		dc: lineDcEnum("dc").notNull(),
	},
	(table) => [
		index("idx_bill_payment_lines_bill_payment_id").on(table.billPaymentId),
		index("idx_bill_payment_lines_bill_id").on(table.billId),
		// vw_invoices aggregates only the credit lines per bill, on every read.
		index("idx_bill_payment_lines_bill_id_dc").on(table.billId, table.dc),
	],
);

export const billPaymentLinesRelations = relations(
	billPaymentLines,
	({ one }) => ({
		billPayment: one(billPayments, {
			fields: [billPaymentLines.billPaymentId],
			references: [billPayments.id],
		}),
		bill: one(bills, {
			fields: [billPaymentLines.billId],
			references: [bills.id],
		}),
	}),
);

/**
 * A single payment of withheld tax to KRA. Structurally this mirrors
 * `bill_payments`, with one deliberate difference: one remittance settles the
 * WHT withheld across many vendors for a filing period, so there is no
 * `vendorId` on the header.
 */
export const whtRemittances = pgTable(
	"wht_remittances",
	{
		id,
		remittanceNo: integer("remittance_no").notNull(),
		remittanceDate: date("remittance_date").notNull(),
		reference: varchar("reference"),
		bankId: varchar("bank_id").references(() => bankAccounts.id),
		creditingAccountId: integer("crediting_account_id").references(
			() => ledgerAccounts.id,
		),
		memo: text("memo"),
		createdBy: varchar("created_by")
			.notNull()
			.references(() => users.id),
		createdAt,
		updatedAt,
	},
	(table) => [
		index("idx_wht_remittances_remittance_no").on(table.remittanceNo),
		index("idx_wht_remittances_remittance_date").on(table.remittanceDate),
		index("idx_wht_remittances_reference").on(table.reference),
	],
);

export const whtRemittancesRelations = relations(
	whtRemittances,
	({ one, many }) => ({
		lines: many(whtRemittanceLines),
		bank: one(bankAccounts, {
			fields: [whtRemittances.bankId],
			references: [bankAccounts.id],
		}),
	}),
);

export const whtRemittanceLines = pgTable(
	"wht_remittance_lines",
	{
		id: serial("id").primaryKey(),
		lineNumber: integer("line_number").notNull(),
		remittanceId: varchar("remittance_id")
			.notNull()
			.references(() => whtRemittances.id, { onDelete: "cascade" }),
		billId: varchar("bill_id")
			.notNull()
			.references(() => bills.id),
		amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
		currentBalance: decimal("current_balance", { precision: 10, scale: 2 })
			.notNull()
			.default("0"),
		dc: lineDcEnum("dc").notNull(),
	},
	(table) => [
		index("idx_wht_remittance_lines_remittance_id").on(table.remittanceId),
		index("idx_wht_remittance_lines_bill_id").on(table.billId),
		// vw_wht_balances aggregates only the credit lines per bill, on every read.
		index("idx_wht_remittance_lines_bill_id_dc").on(table.billId, table.dc),
	],
);

export const whtRemittanceLinesRelations = relations(
	whtRemittanceLines,
	({ one }) => ({
		remittance: one(whtRemittances, {
			fields: [whtRemittanceLines.remittanceId],
			references: [whtRemittances.id],
		}),
		bill: one(bills, {
			fields: [whtRemittanceLines.billId],
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

/**
 * Live view over bills and their payment lines. `balance`, `isOverdue` and
 * `displayStatus` are computed on every read, so they cannot drift the way a
 * stored status column does. `status` carries workflow state only.
 *
 * Every figure describing what the vendor is owed is net of withholding tax:
 * `netPayable` is `total - whtAmount` and `balance` is `netPayable` less the
 * payments made. The withheld portion is owed to KRA instead, and is tracked by
 * `vw_wht_balances`.
 */
export const vwInvoices = pgView("vw_invoices", {
	id: varchar("id").notNull(),
	invoiceDate: date("invoice_date").notNull(),
	dueDate: date("due_date"),
	vendorId: varchar("vendor_id").notNull(),
	invoiceNo: varchar("invoice_no").notNull(),
	name: varchar("name").notNull(),
	total: numeric("total", { precision: 10, scale: 2 }).notNull(),
	whtAmount: numeric("wht_amount", { precision: 10, scale: 2 }).notNull(),
	netPayable: numeric("net_payable", { precision: 10, scale: 2 }).notNull(),
	totalPayment: numeric("total_payment", { precision: 10, scale: 2 }).notNull(),
	balance: numeric("balance", { precision: 10, scale: 2 }).notNull(),
	status: billStatusEnum("status").notNull(),
	isOverdue: boolean("is_overdue").notNull(),
	isPayable: boolean("is_payable").notNull(),
	displayStatus: billStatusEnum("display_status").notNull(),
}).existing();

/**
 * The withholding-tax counterpart of `vw_invoices`: one row per bill carrying
 * the amount withheld, the amount already remitted to KRA, and what is still
 * owed. The remittance screen selects from here the way payments select unpaid
 * bills from `vw_invoices`.
 */
export const vwWhtBalances = pgView("vw_wht_balances", {
	id: varchar("id").notNull(),
	invoiceDate: date("invoice_date").notNull(),
	invoiceNo: varchar("invoice_no").notNull(),
	vendorId: varchar("vendor_id").notNull(),
	name: varchar("name").notNull(),
	taxPin: varchar("tax_pin"),
	total: numeric("total", { precision: 10, scale: 2 }).notNull(),
	whtAmount: numeric("wht_amount", { precision: 10, scale: 2 }).notNull(),
	remittedAmount: numeric("remitted_amount", {
		precision: 10,
		scale: 2,
	}).notNull(),
	whtBalance: numeric("wht_balance", { precision: 10, scale: 2 }).notNull(),
	whtCertificateNo: varchar("wht_certificate_no"),
	whtCertificateIssuedDate: date("wht_certificate_issued_date"),
}).existing();
