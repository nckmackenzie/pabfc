import { relations } from "drizzle-orm";
import {
	date,
	integer,
	jsonb,
	numeric,
	pgEnum,
	pgTable,
	serial,
	text,
	timestamp,
	varchar,
} from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "@/drizzle/schema-helpers";
import {
	memberMemberships,
	members,
	membershipPlans,
} from "@/drizzle/schemas/member";
import { users } from "./auth";
import { ledgerAccounts } from "./chart-of-accounts";
import { vatTypeEnum } from "./settings";

export const DISCOUNT_TYPES = ["none", "amount", "percentage"] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];
export const discountTypeEnum = pgEnum("discount_type", DISCOUNT_TYPES);

export const paymentChannelEnum = pgEnum("payment_channel", [
	"portal",
	"staff",
	"auto_renewal",
]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
	"draft",
	"open",
	"partially_paid",
	"paid",
	"cancelled",
	"overdue",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
	"mpesa_stk",
	"mpesa_manual",
	"cash",
	"card",
	"bank_transfer",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
	"pending",
	"completed",
	"failed",
	"cancelled",
	"refunded",
]);

export const mpesaStkStatusEnum = pgEnum("mpesa_stk_status", [
	"pending",
	"success",
	"failed",
	"timeout",
	"cancelled",
]);

export const customerInvoices = pgTable("customer_invoices", {
	id,
	invoiceNo: varchar("invoice_no", { length: 50 }).notNull().unique(),
	memberId: varchar("member_id")
		.notNull()
		.references(() => members.id),
	issueDate: date("issue_date").notNull(),
	dueDate: date("due_date").notNull(),
	status: invoiceStatusEnum("status").notNull().default("open"),
	currency: varchar("currency", { length: 10 }).notNull().default("KES"),
	subtotalAmount: numeric("subtotal_amount", {
		precision: 18,
		scale: 2,
	}).notNull(),
	taxAmount: numeric("tax_amount", { precision: 18, scale: 2 })
		.notNull()
		.default("0"),
	totalAmount: numeric("total_amount", { precision: 18, scale: 2 }).notNull(),
	balanceAmount: numeric("balance_amount", {
		precision: 18,
		scale: 2,
	}).notNull(),
	source: varchar("source", { length: 50 }), // 'membership'
	sourceId: varchar("source_id"),
	channel: paymentChannelEnum("channel"),
	createdByUserId: varchar("created_by_user_id"),
	createdAt,
	updatedAt,
});

export const customerInvoiceRelations = relations(
	customerInvoices,
	({ one, many }) => ({
		member: one(members, {
			fields: [customerInvoices.memberId],
			references: [members.id],
		}),
		lines: many(customerInvoiceLines),
	}),
);

export const customerInvoiceLines = pgTable("customer_invoice_lines", {
	id: serial("id").primaryKey(),
	invoiceId: varchar("invoice_id")
		.notNull()
		.references(() => customerInvoices.id, { onDelete: "cascade" }),
	lineNumber: integer("line_number").notNull(),
	description: text("description").notNull(),
	planId: varchar("plan_id").references(() => membershipPlans.id),
	membershipId: varchar("membership_id").references(() => memberMemberships.id),
	quantity: numeric("quantity", { precision: 18, scale: 2 })
		.notNull()
		.default("1"),
	unitPrice: numeric("unit_price", { precision: 18, scale: 2 }).notNull(),
	lineSubtotal: numeric("line_subtotal", { precision: 18, scale: 2 }).notNull(),
	taxAmount: numeric("tax_amount", { precision: 18, scale: 2 })
		.notNull()
		.default("0"),
	lineTotal: numeric("line_total", { precision: 18, scale: 2 }).notNull(),
	revenueAccountId: integer("revenue_account_id")
		.notNull()
		.references(() => ledgerAccounts.id),
	taxAccountId: integer("tax_account_id").references(() => ledgerAccounts.id),
});

export const customerInvoiceLineRelations = relations(
	customerInvoiceLines,
	({ one }) => ({
		invoice: one(customerInvoices, {
			fields: [customerInvoiceLines.invoiceId],
			references: [customerInvoices.id],
		}),
		plan: one(membershipPlans, {
			fields: [customerInvoiceLines.planId],
			references: [membershipPlans.id],
		}),
		membership: one(memberMemberships, {
			fields: [customerInvoiceLines.membershipId],
			references: [memberMemberships.id],
		}),
		revenueAccount: one(ledgerAccounts, {
			fields: [customerInvoiceLines.revenueAccountId],
			references: [ledgerAccounts.id],
		}),
		taxAccount: one(ledgerAccounts, {
			fields: [customerInvoiceLines.taxAccountId],
			references: [ledgerAccounts.id],
		}),
	}),
);

export const payments = pgTable("payments", {
	id,
	paymentDate: timestamp("payment_date", { withTimezone: true })
		.notNull()
		.defaultNow(),
	memberId: varchar("member_id")
		.notNull()
		.references(() => members.id),
	planId: varchar("plan_id").references(() => membershipPlans.id),
	paymentNo: varchar("payment_no", { length: 50 }).notNull().unique(),
	amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
	discountType: discountTypeEnum("discount_type").notNull().default("none"),
	discount: numeric("discount", { precision: 18, scale: 2 }),
	discountedAmount: numeric("discount_amount", { precision: 18, scale: 2 })
		.notNull()
		.default("0"),
	lineTotal: numeric("line_total", { precision: 18, scale: 2 }).notNull(),
	vatType: vatTypeEnum("vat_type").notNull().default("none"),
	taxAmount: numeric("tax_amount", { precision: 18, scale: 2 })
		.notNull()
		.default("0"),
	totalAmount: numeric("total_amount", { precision: 18, scale: 2 }).notNull(),
	currency: varchar("currency", { length: 10 }).notNull().default("KES"),
	status: paymentStatusEnum("status").notNull().default("pending"),
	method: paymentMethodEnum("method").notNull(),
	channel: paymentChannelEnum("channel").notNull(),
	reference: varchar("reference", { length: 50 }),
	externalReference: varchar("external_reference", { length: 100 }),
	createdByUserId: varchar("created_by_user_id"),
	notes: text("notes"),
	createdAt,
	updatedAt,
});

export const paymentRelations = relations(payments, ({ one }) => ({
	member: one(members, {
		fields: [payments.memberId],
		references: [members.id],
	}),
	plan: one(membershipPlans, {
		fields: [payments.planId],
		references: [membershipPlans.id],
	}),
	user: one(users, {
		fields: [payments.createdByUserId],
		references: [users.id],
	}),
}));

export const paymentApplications = pgTable("payment_applications", {
	id: serial("id").primaryKey(),
	paymentId: varchar("payment_id")
		.notNull()
		.references(() => payments.id, { onDelete: "cascade" }),
	invoiceId: varchar("invoice_id")
		.notNull()
		.references(() => customerInvoices.id, { onDelete: "cascade" }),
	amountApplied: numeric("amount_applied", {
		precision: 18,
		scale: 2,
	}).notNull(),
});

export const paymentApplicationRelations = relations(
	paymentApplications,
	({ one }) => ({
		payment: one(payments, {
			fields: [paymentApplications.paymentId],
			references: [payments.id],
		}),
		invoice: one(customerInvoices, {
			fields: [paymentApplications.invoiceId],
			references: [customerInvoices.id],
		}),
	}),
);

export const mpesaStkRequests = pgTable("mpesa_stk_requests", {
	id: serial("id").primaryKey(),
	memberId: varchar("member_id")
		.notNull()
		.references(() => members.id),
	invoiceId: varchar("invoice_id").references(() => customerInvoices.id, {
		onDelete: "cascade",
	}),
	paymentId: varchar("payment_id").references(() => payments.id),
	phoneNumber: varchar("phone_number", { length: 20 }).notNull(),
	amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
	status: mpesaStkStatusEnum("status").notNull().default("pending"),
	merchantRequestId: varchar("merchant_request_id", { length: 100 }),
	checkoutRequestId: varchar("checkout_request_id", { length: 100 }),
	rawRequest: jsonb("raw_request"),
	rawResponse: jsonb("raw_response"),
	callbackPayload: jsonb("callback_payload"),
	errorCode: varchar("error_code", { length: 50 }),
	errorMessage: varchar("error_message", { length: 255 }),
	initiatedChannel: paymentChannelEnum("initiated_channel").notNull(),
	initiatedByUserId: varchar("initiated_by_user_id"),
	createdAt,
	updatedAt,
	callbackReceivedAt: timestamp("callback_received_at", { withTimezone: true }),
});
