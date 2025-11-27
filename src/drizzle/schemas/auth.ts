import { relations } from "drizzle-orm";
import {
	boolean,
	index,
	inet,
	integer,
	pgEnum,
	pgTable,
	primaryKey,
	serial,
	text,
	timestamp,
	varchar,
} from "drizzle-orm/pg-core";

import { active, id } from "@/drizzle/schema-helpers";
import { activityLogs } from "./audit-logs";

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
		memberId: varchar("member_id", { length: 255 }).unique(),
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

export const loginAttempts = pgTable(
	"login_attempts",
	{
		id,
		userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
		ipAddress: inet("ip_address").notNull(),
		userAgent: text("user_agent"),
		success: boolean("success").notNull(),
		attemptedAt: timestamp("attempted_at").defaultNow(),
		failureReason: text("failure_reason"),
	},
	(table) => [
		index("login_attempts_user_id_index").on(table.userId),
		index("login_attempts_ip_address_idx").on(table.ipAddress),
		index("login_attempts_attempted_at_idx").on(table.attemptedAt),
	],
);

export const forms = pgTable("forms", {
	id: serial("id").primaryKey().notNull(),
	name: varchar("name").notNull(),
	module: varchar("module").notNull(),
	moduleId: integer("module_id").notNull(),
	path: varchar("path").notNull(),
	menuOrder: integer("menu_order").notNull(),
	resource: varchar("resource").notNull(),
	active,
});

export const roles = pgTable("roles", {
	id,
	name: varchar("name", { length: 128 }).notNull(),
	description: varchar("description", { length: 512 }),
	isSystem: boolean("is_system").notNull().default(false),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const permissions = pgTable("permissions", {
	id,
	resource: varchar("resource", { length: 64 }).notNull(), // "loans", "accounts", "users", "audit", ...
	action: varchar("action", { length: 64 }).notNull(), // "view", "create", "approve", "disburse" ...
	key: varchar("key", { length: 128 }).notNull().unique(), // `${resource}:${action}`
	description: varchar("description").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const rolePermissions = pgTable(
	"role_permissions",
	{
		roleId: varchar("role_id", { length: 36 }).notNull(),
		permissionId: varchar("permission_id", { length: 36 }).notNull(),
	},
	(t) => [primaryKey({ columns: [t.roleId, t.permissionId] })],
);

export const userRoles = pgTable(
	"user_roles",
	{
		userId: varchar("user_id", { length: 36 }).notNull(),
		roleId: varchar("role_id", { length: 36 }).notNull(),
	},
	(t) => [primaryKey({ columns: [t.userId, t.roleId] })],
);

export const usersRelations = relations(users, ({ many }) => ({
	userRoles: many(userRoles),
	sessions: many(sessions),
	loginAttempts: many(loginAttempts),
	accounts: many(accounts),
	twoFactors: many(twoFactors),
	activityLogs: many(activityLogs),
}));

export const attempRelations = relations(loginAttempts, ({ one }) => ({
	user: one(users, { fields: [loginAttempts.userId], references: [users.id] }),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
	rolePermissions: many(rolePermissions),
	userRoles: many(userRoles),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
	rolePermissions: many(rolePermissions),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
	user: one(users, {
		fields: [userRoles.userId],
		references: [users.id],
	}),
	role: one(roles, {
		fields: [userRoles.roleId],
		references: [roles.id],
	}),
}));

export const rolePermissionsRelations = relations(
	rolePermissions,
	({ one }) => ({
		role: one(roles, {
			fields: [rolePermissions.roleId],
			references: [roles.id],
		}),
		permission: one(permissions, {
			fields: [rolePermissions.permissionId],
			references: [permissions.id],
		}),
	}),
);

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
