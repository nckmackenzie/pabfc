import { relations } from "drizzle-orm";
import {
	boolean,
	integer,
	numeric,
	pgTable,
	serial,
	text,
	timestamp,
	varchar,
} from "drizzle-orm/pg-core";
import { active, createdAt, id, updatedAt } from "@/drizzle/schema-helpers";
import { ledgerAccounts } from "./chart-of-accounts";
import { members } from "./member";
import { paymentChannelEnum, paymentMethodEnum, paymentStatusEnum } from "./payment-enums";
import { payments } from "./payments";
import { vatTypeEnum } from "./settings";

export const addons = pgTable("addons", {
	id,
	name: varchar("name").notNull(),
	description: text("description"),
	amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
	perMember: boolean("per_member").notNull().default(false),
	revenueAccountId: integer("revenue_account_id")
		.notNull()
		.references(() => ledgerAccounts.id),
	active,
	createdAt,
	updatedAt,
});

export const addonsRelations = relations(addons, ({ many }) => ({
	invoiceLines: many(addonInvoiceLines),
}));

export const addonInvoices = pgTable("addon_invoices", {
	id,
	invoiceNo: varchar("invoice_no", { length: 50 }).notNull().unique(),
	// the billing member
	memberId: varchar("member_id")
		.notNull()
		.references(() => members.id),
	// null for standalone addon payments; populated when addons are paid alongside
	// a membership plan payment
	paymentId: varchar("payment_id").references(() => payments.id),
	paymentDate: timestamp("payment_date", { withTimezone: true }).notNull().defaultNow(),
	numberOfPeriods: integer("number_of_periods").notNull().default(1),
	numberOfMembers: integer("number_of_members").notNull().default(1),
	subtotalAmount: numeric("subtotal_amount", {
		precision: 18,
		scale: 2,
	}).notNull(),
	taxAmount: numeric("tax_amount", { precision: 18, scale: 2 }).notNull().default("0"),
	totalAmount: numeric("total_amount", { precision: 18, scale: 2 }).notNull(),
	vatType: vatTypeEnum("vat_type").notNull().default("none"),
	status: paymentStatusEnum("status").notNull().default("completed"),
	method: paymentMethodEnum("method").notNull(),
	channel: paymentChannelEnum("channel").notNull(),
	reference: varchar("reference", { length: 50 }),
	notes: text("notes"),
	createdByUserId: varchar("created_by_user_id"),
	createdAt,
	updatedAt,
});

export const addonInvoicesRelations = relations(addonInvoices, ({ one, many }) => ({
	member: one(members, {
		fields: [addonInvoices.memberId],
		references: [members.id],
	}),
	payment: one(payments, {
		fields: [addonInvoices.paymentId],
		references: [payments.id],
	}),
	lines: many(addonInvoiceLines),
}));

export const addonInvoiceLines = pgTable("addon_invoice_lines", {
	id: serial("id").primaryKey(),
	addonInvoiceId: varchar("addon_invoice_id")
		.notNull()
		.references(() => addonInvoices.id, { onDelete: "cascade" }),
	// nullable so historical lines survive addon deletion
	addonId: varchar("addon_id").references(() => addons.id, { onDelete: "set null" }),
	// snapshotted at creation
	addonName: varchar("addon_name", { length: 255 }).notNull(),
	unitAmount: numeric("unit_amount", { precision: 10, scale: 2 }).notNull(),
	perMember: boolean("per_member").notNull(),
	revenueAccountId: integer("revenue_account_id")
		.notNull()
		.references(() => ledgerAccounts.id),
	numberOfPeriods: integer("number_of_periods").notNull(),
	numberOfMembers: integer("number_of_members").notNull().default(1),
	// unitAmount × numberOfPeriods × (numberOfMembers if perMember else 1)
	lineSubtotal: numeric("line_subtotal", { precision: 18, scale: 2 }).notNull(),
	taxAmount: numeric("tax_amount", { precision: 18, scale: 2 }).notNull().default("0"),
	// lineSubtotal + taxAmount
	lineTotal: numeric("line_total", { precision: 18, scale: 2 }).notNull(),
});

export const addonInvoiceLinesRelations = relations(addonInvoiceLines, ({ one }) => ({
	invoice: one(addonInvoices, {
		fields: [addonInvoiceLines.addonInvoiceId],
		references: [addonInvoices.id],
	}),
	addon: one(addons, {
		fields: [addonInvoiceLines.addonId],
		references: [addons.id],
	}),
}));
