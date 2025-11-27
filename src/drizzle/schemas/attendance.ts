import { relations } from "drizzle-orm";
import {
	bigserial,
	pgTable,
	text,
	timestamp,
	varchar,
} from "drizzle-orm/pg-core";
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
});

export const attendanceLogsRelations = relations(attendanceLogs, ({ one }) => ({
	member: one(members, {
		fields: [attendanceLogs.memberId],
		references: [members.id],
	}),
}));
