import { relations } from "drizzle-orm";
import {
	boolean,
	date,
	index,
	integer,
	numeric,
	pgTable,
	timestamp,
	varchar,
} from "drizzle-orm/pg-core";
import { createdAt, id } from "@/drizzle/schema-helpers";
import {
	ledgerAccounts,
	lineDcEnum,
} from "@/drizzle/schemas/chart-of-accounts";

export const ledgerAccountsRelations = relations(ledgerAccounts, ({ one }) => ({
	bank: one(bankAccounts),
}));

export const bankAccounts = pgTable(
	"bank_accounts",
	{
		id,
		accountId: integer("account_id")
			.notNull()
			.references(() => ledgerAccounts.id, { onDelete: "cascade" }),
		bankName: varchar("bank_name", { length: 255 }).notNull(),
		accountNumber: varchar("account_number", { length: 50 }).notNull(),
		currencyCode: varchar("currency_code", { length: 3 }).notNull(), // "KES", "USD", etc.
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("bank_accounts_bank_name_idx").on(table.bankName),
		index("bank_accounts_account_number_idx").on(table.accountNumber),
	],
);

export const bankAccountsRelations = relations(bankAccounts, ({ one }) => ({
	ledgerAccount: one(ledgerAccounts, {
		fields: [bankAccounts.accountId],
		references: [ledgerAccounts.id],
	}),
}));

export const bankPostings = pgTable(
	"bank_postings",
	{
		id,
		transactionDate: date("transaction_date").notNull(),
		bankId: varchar("bank_id")
			.notNull()
			.references(() => bankAccounts.id),
		dc: lineDcEnum("dc").notNull(),
		amount: numeric("amount").notNull(),
		reference: varchar("reference", { length: 255 }).notNull(),
		cleared: boolean("cleared").default(false),
		clearedAt: date("cleared_at"),
		narration: varchar("narration", { length: 255 }),
		source: varchar("source_type", { length: 50 }),
		sourceId: varchar("source_id", { length: 50 }),
		createdAt,
	},
	(table) => [
		index("bank_postings_bank_id_idx").on(table.bankId),
		index("bank_postings_transaction_date_idx").on(table.transactionDate),
		index("bank_postings_reference_idx").on(table.reference),
	],
);
