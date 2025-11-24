import { relations } from "drizzle-orm";
import {
	boolean,
	index,
	pgEnum,
	pgTable,
	text,
	timestamp,
} from "drizzle-orm/pg-core";
import { id } from "@/drizzle/schema-helpers";

export const usersType = ["admin", "staff", "member"] as const;
export type UserType = (typeof usersType)[number];
export const userTypeEnum = pgEnum("user_type", usersType);

export const users = pgTable(
	"users",
	{
		id,
		name: text("name").notNull(),
		email: text("email").unique(),
		emailVerified: boolean("email_verified").default(false).notNull(),
		image: text("image"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		twoFactorEnabled: boolean("two_factor_enabled").default(false),
		role: userTypeEnum("role").default("staff").notNull(),
		banned: boolean("banned").default(false),
		banReason: text("ban_reason"),
		banExpires: timestamp("ban_expires"),
		username: text("username").unique(),
		displayUsername: text("display_username"),
		contact: text("contact").notNull(),
		active: boolean("active").default(true).notNull(),
		deleted_at: timestamp("deleted_at"),
	},
	(table) => [
		index("users_name_idx").on(table.email),
		index("users_contact_idx").on(table.contact),
	],
);

export const sessions = pgTable(
	"sessions",
	{
		id,
		expiresAt: timestamp("expires_at").notNull(),
		token: text("token").notNull().unique(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		impersonatedBy: text("impersonated_by"),
	},
	(table) => [index("sessions_userId_idx").on(table.userId)],
);

export const accounts = pgTable(
	"accounts",
	{
		id,
		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		idToken: text("id_token"),
		accessTokenExpiresAt: timestamp("access_token_expires_at"),
		refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
		scope: text("scope"),
		password: text("password"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [index("accounts_userId_idx").on(table.userId)],
);

export const verifications = pgTable(
	"verifications",
	{
		id,
		identifier: text("identifier").notNull(),
		value: text("value").notNull(),
		expiresAt: timestamp("expires_at").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [index("verifications_identifier_idx").on(table.identifier)],
);

export const twoFactors = pgTable("two_factors", {
	id,
	secret: text("secret").notNull(),
	backupCodes: text("backup_codes").notNull(),
	userId: text("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
});

export const userRelations = relations(users, ({ many }) => ({
	sessions: many(sessions),
	accounts: many(accounts),
	twoFactors: many(twoFactors),
}));

export const sessionRelations = relations(sessions, ({ one }) => ({
	users: one(users, {
		fields: [sessions.userId],
		references: [users.id],
	}),
}));

export const accountRelations = relations(accounts, ({ one }) => ({
	users: one(users, {
		fields: [accounts.userId],
		references: [users.id],
	}),
}));

export const twoFactorRelations = relations(twoFactors, ({ one }) => ({
	users: one(users, {
		fields: [twoFactors.userId],
		references: [users.id],
	}),
}));
