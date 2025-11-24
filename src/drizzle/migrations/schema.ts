import {
	boolean,
	foreignKey,
	index,
	inet,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	primaryKey,
	serial,
	text,
	timestamp,
	unique,
	varchar,
} from "drizzle-orm/pg-core";

export const userType = pgEnum("user_type", [
	"superadmin",
	"admin",
	"user",
	"member",
]);

export const verifications = pgTable("verifications", {
	id: text().primaryKey().notNull(),
	identifier: text().notNull(),
	value: text().notNull(),
	expiresAt: timestamp("expires_at", { mode: "string" }).notNull(),
	createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow().notNull(),
});

export const accounts = pgTable(
	"accounts",
	{
		id: text().primaryKey().notNull(),
		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		userId: text("user_id").notNull(),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		idToken: text("id_token"),
		accessTokenExpiresAt: timestamp("access_token_expires_at", {
			mode: "string",
		}),
		refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
			mode: "string",
		}),
		scope: text(),
		password: text(),
		createdAt: timestamp("created_at", { mode: "string" })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { mode: "string" }).notNull(),
	},
	(table) => [
		foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "accounts_user_id_users_id_fk",
		}).onDelete("cascade"),
	],
);

export const sessions = pgTable(
	"sessions",
	{
		id: text().primaryKey().notNull(),
		expiresAt: timestamp("expires_at", { mode: "string" }).notNull(),
		token: text().notNull(),
		createdAt: timestamp("created_at", { mode: "string" })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { mode: "string" }).notNull(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		userId: text("user_id").notNull(),
	},
	(table) => [
		foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "sessions_user_id_users_id_fk",
		}).onDelete("cascade"),
		unique("sessions_token_unique").on(table.token),
	],
);

export const permissions = pgTable(
	"permissions",
	{
		id: varchar().primaryKey().notNull(),
		resource: varchar({ length: 64 }).notNull(),
		action: varchar({ length: 64 }).notNull(),
		key: varchar({ length: 128 }).notNull(),
		createdAt: timestamp("created_at", {
			withTimezone: true,
			mode: "string",
		}).defaultNow(),
		description: varchar().notNull(),
	},
	(table) => [unique("permissions_key_unique").on(table.key)],
);

export const forms = pgTable("forms", {
	id: serial().primaryKey().notNull(),
	name: varchar().notNull(),
	module: varchar().notNull(),
	moduleId: integer("module_id").notNull(),
	path: varchar().notNull(),
	menuOrder: integer("menu_order").notNull(),
	resource: varchar().notNull(),
	active: boolean().default(true).notNull(),
});

export const roles = pgTable("roles", {
	id: varchar().primaryKey().notNull(),
	name: varchar({ length: 128 }).notNull(),
	description: varchar({ length: 512 }),
	isSystem: boolean("is_system").default(false).notNull(),
	createdAt: timestamp("created_at", {
		withTimezone: true,
		mode: "string",
	}).defaultNow(),
	updatedAt: timestamp("updated_at", {
		withTimezone: true,
		mode: "string",
	}).defaultNow(),
});

export const loginAttempts = pgTable(
	"login_attempts",
	{
		id: varchar().primaryKey().notNull(),
		userId: text("user_id"),
		ipAddress: inet("ip_address").notNull(),
		userAgent: text("user_agent"),
		success: boolean().notNull(),
		attemptedAt: timestamp("attempted_at", { mode: "string" }).defaultNow(),
		failureReason: text("failure_reason"),
	},
	(table) => [
		index("login_attempts_attempted_at_idx").using(
			"btree",
			table.attemptedAt.asc().nullsLast().op("timestamp_ops"),
		),
		index("login_attempts_ip_address_idx").using(
			"btree",
			table.ipAddress.asc().nullsLast().op("inet_ops"),
		),
		index().using("btree", table.userId.asc().nullsLast().op("text_ops")),
		foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "login_attempts_user_id_users_id_fk",
		}).onDelete("cascade"),
	],
);

export const users = pgTable(
	"users",
	{
		id: text().primaryKey().notNull(),
		name: text().notNull(),
		email: text().notNull(),
		emailVerified: boolean("email_verified").default(false).notNull(),
		image: text(),
		createdAt: timestamp("created_at", { mode: "string" })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { mode: "string" })
			.defaultNow()
			.notNull(),
		contact: text(),
		userType: userType("user_type").default("user").notNull(),
		active: boolean().default(true).notNull(),
		memberId: text("member_id"),
		deletedAt: timestamp("deleted_at", { mode: "string" }),
		username: text(),
		displayUsername: text("display_username"),
		isLocked: boolean("is_locked").default(false).notNull(),
		lockedUntil: timestamp("locked_until", { mode: "string" }),
		failedLoginAttempts: integer("failed_login_attempts").default(0),
	},
	(table) => [
		index().using("btree", table.name.asc().nullsLast().op("text_ops")),
		unique("users_username_unique").on(table.username),
	],
);

export const settings = pgTable(
	"settings",
	{
		id: varchar().primaryKey().notNull(),
		security: jsonb().default({
			twoFactorMethod: "sms",
			twoFactorEnabled: false,
			lockAfterAttempts: 5,
			passwordExpiryDays: 90,
			lockDurationMinutes: 15,
			enforcePasswordExpiry: false,
		}),
		member: jsonb().default({}),
		loan: jsonb().default({}),
		savings: jsonb().default({}),
		createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
			.defaultNow()
			.notNull(),
		createdBy: text("created_by").notNull(),
		updatedBy: text("updated_by"),
		system: jsonb().default({}),
	},
	(table) => [
		foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "settings_created_by_users_id_fk",
		}),
		foreignKey({
			columns: [table.updatedBy],
			foreignColumns: [users.id],
			name: "settings_updated_by_users_id_fk",
		}),
	],
);

export const activityLogs = pgTable(
	"activity_logs",
	{
		id: varchar().primaryKey().notNull(),
		timestamp: timestamp({ mode: "string" }).defaultNow().notNull(),
		userId: text("user_id").notNull(),
		action: varchar({ length: 200 }).notNull(),
		details: text().notNull(),
		ipAddress: varchar("ip_address", { length: 45 }),
		userAgent: text("user_agent"),
		os: varchar({ length: 100 }),
	},
	(table) => [
		index("activity_logs_action_idx").using(
			"btree",
			table.action.asc().nullsLast().op("text_ops"),
		),
		index("activity_logs_details_idx").using(
			"btree",
			table.details.asc().nullsLast().op("text_ops"),
		),
		foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "activity_logs_user_id_users_id_fk",
		}),
	],
);

export const rolePermissions = pgTable(
	"role_permissions",
	{
		roleId: varchar("role_id", { length: 36 }).notNull(),
		permissionId: varchar("permission_id", { length: 36 }).notNull(),
	},
	(table) => [
		primaryKey({
			columns: [table.roleId, table.permissionId],
			name: "role_permissions_role_id_permission_id_pk",
		}),
	],
);

export const userRoles = pgTable(
	"user_roles",
	{
		userId: varchar("user_id", { length: 36 }).notNull(),
		roleId: varchar("role_id", { length: 36 }).notNull(),
	},
	(table) => [
		primaryKey({
			columns: [table.userId, table.roleId],
			name: "user_roles_user_id_role_id_pk",
		}),
	],
);
