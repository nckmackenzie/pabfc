import {
	boolean,
	integer,
	pgEnum,
	pgTable,
	serial,
	text,
	varchar,
} from "drizzle-orm/pg-core";
import { createdAt, updatedAt } from "@/drizzle/schema-helpers";

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

export const accounts = pgTable("accounts", {
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
});
