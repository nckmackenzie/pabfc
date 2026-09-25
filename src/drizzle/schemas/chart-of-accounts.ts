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
import { createdAt, updatedAt } from "@/drizzle/schema-helpers";
import {
	LEDGER_ACCOUNT_ROLE_KEYS,
	type LedgerAccountRole,
} from "@/features/coa/lib/account-roles";

export const accountType = [
	"asset",
	"liability",
	"equity",
	"revenue",
	"expense",
] as const;

export type AccountType = (typeof accountType)[number];

export const accountTypeEnum = pgEnum("account_type", accountType);

export const normalBalanceEnum = pgEnum("normal_balance", ["debit", "credit"]);

export const lineDcEnum = pgEnum("line_dc", ["debit", "credit"]);

const ledgerAccountRoleValues = LEDGER_ACCOUNT_ROLE_KEYS as [
	LedgerAccountRole,
	...Array<LedgerAccountRole>,
];

export const ledgerAccountRoleEnum = pgEnum(
	"ledger_account_role",
	ledgerAccountRoleValues,
);

export const ledgerAccounts = pgTable(
	"ledger_accounts",
	{
		id: serial("id").primaryKey(),
		code: varchar("code", { length: 20 }).unique(),
		name: varchar("name", { length: 255 }).notNull(),
		type: accountTypeEnum("type").notNull(),
		normalBalance: normalBalanceEnum("normal_balance").notNull(),
		parentId: integer("parent_id"),
		isPosting: boolean("is_posting").notNull().default(true),
		isActive: boolean("is_active").notNull().default(true),
		description: text("description"),
		createdAt,
		updatedAt,
	},
	(table) => [
		index("idx_accounts_code").on(table.code),
		index("idx_accounts_name").on(table.name),
	],
);

export const journalEntries = pgTable("journal_entries", {
	id: serial("id").primaryKey(),
	entryDate: date("entry_date").notNull(),
	reference: varchar("reference", { length: 50 }),
	description: text("description"),
	source: varchar("source", { length: 50 }), // optional: 'manual', 'invoice', etc
	sourceId: varchar("source_id", { length: 50 }),
	journalNo: integer("journal_no"),
	createdAt,
	updatedAt,
});

export const journalRelations = relations(journalEntries, ({ many }) => ({
	lines: many(journalLines),
}));

export const journalLines = pgTable("journal_lines", {
	id: serial("id").primaryKey(),
	journalEntryId: integer("journal_entry_id")
		.notNull()
		.references(() => journalEntries.id, { onDelete: "cascade" }),
	accountId: integer("account_id")
		.notNull()
		.references(() => ledgerAccounts.id),
	dc: lineDcEnum("dc").notNull(), // 'DEBIT' or 'CREDIT'
	amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
	memo: text("memo"),
	lineNumber: integer("line_number").notNull(),
});

export const journalLinesRelations = relations(journalLines, ({ one }) => ({
	account: one(ledgerAccounts, {
		fields: [journalLines.accountId],
		references: [ledgerAccounts.id],
	}),
	journalEntry: one(journalEntries, {
		fields: [journalLines.journalEntryId],
		references: [journalEntries.id],
	}),
}));

/**
 * Binds each posting role the application knows about to a real ledger account.
 * This table is the source of truth: it is edited from the Account Mappings page,
 * and postings resolve the account by `role` and use the mapped `account_id`.
 *
 * Resolving by id is what makes renaming an account safe — the previous behaviour
 * matched accounts on `lower(name)`, so a rename silently created a duplicate and
 * stranded the balance on the original.
 */
export const ledgerAccountMappings = pgTable(
	"ledger_account_mappings",
	{
		id: serial("id").primaryKey(),
		role: ledgerAccountRoleEnum("role").notNull().unique(),
		accountId: integer("account_id")
			.notNull()
			.references(() => ledgerAccounts.id),
		description: text("description"),
		createdAt,
		updatedAt,
	},
	(table) => [index("idx_ledger_account_mappings_role").on(table.role)],
);

export const ledgerAccountMappingsRelations = relations(
	ledgerAccountMappings,
	({ one }) => ({
		account: one(ledgerAccounts, {
			fields: [ledgerAccountMappings.accountId],
			references: [ledgerAccounts.id],
		}),
	}),
);
