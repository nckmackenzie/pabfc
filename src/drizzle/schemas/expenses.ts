import { relations } from "drizzle-orm";
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
	varchar,
} from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "../schema-helpers";
import { users } from "./auth";
import { bankAccounts } from "./bank";
import { ledgerAccounts } from "./chart-of-accounts";
import { vatTypeEnum } from "./settings";

export const PAYMENT_METHODS = ["cash", "cheque", "mpesa", "bank"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const expensePaymentMethodEnum = pgEnum(
	"expense_payment_method",
	PAYMENT_METHODS,
);

export const payees = pgTable("payees", {
	id,
	name: text("name").notNull(),
	description: text("description"),
	isActive: boolean("is_active").notNull().default(true),
});

export const payeesRelations = relations(payees, ({ many }) => ({
	expenses: many(expenseHeaders),
}));

export const expenseHeaders = pgTable(
	"expense_headers",
	{
		id,
		expenseDate: date("expense_date").notNull(),
		expenseNo: integer("expense_no").notNull(),
		payeeId: varchar("payee_id")
			.notNull()
			.references(() => payees.id),
		paymentMethod: expensePaymentMethodEnum("payment_method").notNull(),
		reference: varchar("reference", { length: 50 }),
		subTotal: numeric("sub_total", { precision: 18, scale: 2 }).notNull(),
		taxAmount: numeric("tax_amount", { precision: 18, scale: 2 }).notNull(),
		totalAmount: numeric("total_amount", { precision: 18, scale: 2 }).notNull(),
		currency: varchar("currency", { length: 10 }).notNull().default("KES"),
		bankId: varchar("bank_id").references(() => bankAccounts.id),
		creditingAccountId: integer("crediting_account_id").references(
			() => ledgerAccounts.id,
		),
		createdByUserId: varchar("created_by_user_id")
			.notNull()
			.references(() => users.id),
		createdAt,
		updatedAt,
	},
	(table) => [
		index("expenses_expense_no_idx").on(table.expenseNo),
		index("expenses_reference_idx").on(table.reference),
		index("expense_expense_date_idx").on(table.expenseDate),
	],
);

export const expenseHeadersRelations = relations(
	expenseHeaders,
	({ one, many }) => ({
		payee: one(payees, {
			fields: [expenseHeaders.payeeId],
			references: [payees.id],
		}),
		createdBy: one(users, {
			fields: [expenseHeaders.createdByUserId],
			references: [users.id],
		}),
		details: many(expenseDetails),
		attachments: many(expenseAttachments),
	}),
);

export const expenseDetails = pgTable("expense_details", {
	id,
	expenseHeaderId: varchar("expense_header_id")
		.notNull()
		.references(() => expenseHeaders.id),
	lineNumber: integer("line_number").notNull(),
	accountId: integer("account_id")
		.notNull()
		.references(() => ledgerAccounts.id),
	quantity: numeric("quantity", { precision: 18, scale: 2 })
		.notNull()
		.default("1"),
	unitPrice: numeric("unit_price", { precision: 18, scale: 2 }).notNull(),
	lineSubtotal: numeric("line_subtotal", { precision: 18, scale: 2 }).notNull(),
	vatType: vatTypeEnum("vat_type").notNull().default("none"),
	taxAmount: numeric("tax_amount", { precision: 18, scale: 2 })
		.notNull()
		.default("0"),
	lineTotal: numeric("line_total", { precision: 18, scale: 2 }).notNull(),
	description: text("description"),
	createdAt,
	updatedAt,
});

export const expenseLinesRelations = relations(expenseDetails, ({ one }) => ({
	expenseHeader: one(expenseHeaders, {
		fields: [expenseDetails.expenseHeaderId],
		references: [expenseHeaders.id],
	}),
}));

export const expenseAttachments = pgTable("expense_attachments", {
	id: serial("id").primaryKey(),
	expenseHeaderId: varchar("expense_header_id")
		.notNull()
		.references(() => expenseHeaders.id),
	fileUrl: varchar("file_url").notNull(),
	fileName: varchar("file_name"),
	fileType: varchar("file_type"),
	createdAt,
	updatedAt,
});

export const expenseAttachmentsRelations = relations(
	expenseAttachments,
	({ one }) => ({
		expenseHeader: one(expenseHeaders, {
			fields: [expenseAttachments.expenseHeaderId],
			references: [expenseHeaders.id],
		}),
	}),
);
