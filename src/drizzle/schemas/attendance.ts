import { relations } from "drizzle-orm";
import {
	bigserial,
	boolean,
	index,
	integer,
	jsonb,
	numeric,
	pgMaterializedView,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { createdAt, updatedAt } from "../schema-helpers";
import { members } from "./member";

export const attendanceLogs = pgTable("attendance_logs", {
	id: bigserial("id", { mode: "bigint" }).primaryKey(),
	memberId: varchar("member_id")
		.notNull()
		.references(() => members.id),
	checkInTime: timestamp("check_in_time", { withTimezone: true }).notNull(),
	checkOutTime: timestamp("check_out_time", { withTimezone: true }),
	source: varchar("source", { length: 30 }), // 'reception','turnstile','kiosk','mobile_app'
	deviceId: varchar("device_id", { length: 100 }),
	notes: text("notes"),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	biotimeId: integer("biotime_id").unique(),
});

export const attendanceLogsRelations = relations(attendanceLogs, ({ one }) => ({
	member: one(members, {
		fields: [attendanceLogs.memberId],
		references: [members.id],
	}),
}));

export const biotimeAttendanceSyncState = pgTable(
	"biotime_attendance_sync_state",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		lastSuccessfulSyncAt: timestamp("last_successful_sync_at", {
			withTimezone: true,
		}),
		lastAttemptedSyncAt: timestamp("last_attempted_sync_at", {
			withTimezone: true,
		}),
		lastFetchedStartTime: timestamp("last_fetched_start_time", {
			withTimezone: true,
		}),
		lastFetchedEndTime: timestamp("last_fetched_end_time", {
			withTimezone: true,
		}),
		lastInsertedCount: integer("last_inserted_count").notNull().default(0),
		lastSkippedDuplicateCount: integer("last_skipped_duplicate_count")
			.notNull()
			.default(0),
		lastUnmappedCount: integer("last_unmapped_count").notNull().default(0),
		lastError: text("last_error"),
		createdAt,
		updatedAt,
	},
);

export const biotimeUnmappedAttendanceTransactions = pgTable(
	"biotime_unmapped_attendance_transactions",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		biotimeId: integer("biotime_id").notNull(),
		empCode: varchar("emp_code", { length: 50 }).notNull(),
		punchTime: timestamp("punch_time", {
			withTimezone: true,
		}).notNull(),
		punchState: varchar("punch_state", { length: 10 }),
		punchStateDisplay: varchar("punch_state_display", { length: 50 }),
		terminalSn: varchar("terminal_sn", { length: 100 }),
		rawPayload: jsonb("raw_payload"),
		resolved: boolean("resolved").notNull().default(false),
		resolvedAt: timestamp("resolved_at", { withTimezone: true }),
		notes: text("notes"),
		createdAt,
		updatedAt,
	},
	(table) => [
		uniqueIndex("uq_biotime_unmapped_attendance_biotime_id").on(
			table.biotimeId,
		),
		index("idx_biotime_unmapped_attendance_emp_code").on(table.empCode),
		index("idx_biotime_unmapped_attendance_resolved").on(table.resolved),
	],
);

export const attendanceOverview = pgMaterializedView("vw_attendance_details", {
	id: bigserial("id", { mode: "bigint" }).notNull(),
	memberName: varchar("member_name").notNull(),
	image: varchar("image"),
	checkInTime: timestamp("check_in_time").notNull(),
	checkOutTime: timestamp("check_out_time").notNull(),
	duration: numeric("duration"),
	activePlanName: varchar("active_plan_name"),
	nextRenewalDate: timestamp("next_renewal_date"),
}).existing();
