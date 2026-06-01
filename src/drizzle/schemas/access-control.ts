import {
	boolean,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { createdAt, updatedAt } from "@/drizzle/schema-helpers";
import { members } from "@/drizzle/schemas/member";
import { accessSyncActionEnum, accessSyncStatusEnum } from "./member";

export const accessControlSyncJobs = pgTable(
	"access_control_sync_jobs",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		memberId: varchar("member_id")
			.notNull()
			.references(() => members.id, { onDelete: "cascade" }),
		action: accessSyncActionEnum("action").notNull(),
		status: accessSyncStatusEnum("status").notNull().default("pending"),
		payload: jsonb("payload").notNull(),
		idempotencyKey: varchar("idempotency_key", { length: 255 }).notNull(),
		attempts: integer("attempts").notNull().default(0),
		maxAttempts: integer("max_attempts").notNull().default(10),
		claimedAt: timestamp("claimed_at", { withTimezone: true }),
		claimedUntil: timestamp("claimed_until", { withTimezone: true }),
		lastError: text("last_error"),

		createdAt,
		updatedAt,

		completedAt: timestamp("completed_at", { withTimezone: true }),
	},
	(table) => [
		uniqueIndex("uq_access_sync_jobs_idempotency").on(table.idempotencyKey),
		index("idx_access_sync_jobs_status").on(table.status),
		index("idx_access_sync_jobs_member").on(table.memberId),
	],
);

export const biotimeSettings = pgTable("biotime_settings", {
	id: uuid("id").primaryKey().defaultRandom(),
	baseUrl: varchar("base_url", { length: 255 })
		.notNull()
		.default("http://127.0.0.1/"),
	username: varchar("username", { length: 255 }),
	password: text("password"),
	defaultDepartmentId: integer("default_department_id").notNull().default(1),
	authorizedAreaId: integer("authorized_area_id").notNull().default(2),
	unauthorizedAreaId: integer("unauthorized_area_id").notNull().default(1),
	deviceSerialNumber: varchar("device_serial_number", { length: 100 }),
	syncEnabled: boolean("sync_enabled").notNull().default(true),
	pollIntervalSeconds: integer("poll_interval_seconds").notNull().default(30),
	batchSize: integer("batch_size").notNull().default(10),
	notes: text("notes"),
	createdAt,
	updatedAt,
});

export const accessControlSyncAttempts = pgTable(
	"access_control_sync_attempts",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		jobId: uuid("job_id")
			.notNull()
			.references(() => accessControlSyncJobs.id, { onDelete: "cascade" }),

		success: boolean("success").notNull(),
		requestPayload: jsonb("request_payload"),
		responsePayload: jsonb("response_payload"),
		errorMessage: text("error_message"),
		createdAt,
	},
	(table) => [index("idx_access_sync_attempts_job").on(table.jobId)],
);

export const accessControlAgents = pgTable(
	"access_control_agents",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		name: varchar("name", { length: 100 }).notNull(),
		machineName: varchar("machine_name", { length: 100 }),
		apiKeyHash: text("api_key_hash").notNull(),
		isActive: boolean("is_active").notNull().default(true),
		lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
		lastIpAddress: varchar("last_ip_address", { length: 100 }),
		status: varchar("status", { length: 30 }).notNull().default("offline"),
		lastError: text("last_error"),
		createdAt,
		updatedAt,
	},
	(table) => [
		uniqueIndex("uq_access_control_agents_name").on(table.name),
		index("idx_access_control_agents_status").on(table.status),
	],
);
