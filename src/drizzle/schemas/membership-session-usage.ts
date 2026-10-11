import { relations } from "drizzle-orm";
import {
	bigint,
	date,
	index,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	varchar,
} from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "@/drizzle/schema-helpers";
import { attendanceLogs } from "./attendance";
import { users } from "./auth";
import { memberMemberships, members } from "./member";

// One row per Nairobi-local day consumed against a session-based membership.
// A waived day is a voided row (voidedAt set), never deleted — reconciliation
// must see it to avoid re-creating it. See reconcileOneMembership.
export const membershipSessionUsage = pgTable(
	"membership_session_usage",
	{
		id,
		membershipId: varchar("membership_id")
			.notNull()
			.references(() => memberMemberships.id, { onDelete: "restrict" }),
		memberId: varchar("member_id")
			.notNull()
			.references(() => members.id, { onDelete: "restrict" }),
		usageDate: date("usage_date").notNull(),
		source: varchar("source", { length: 20 }).notNull(), // 'punch' | 'manual'
		// Nullable + onDelete set null: this table is the durable audit trail and
		// must survive attendance_logs cleanup (see Task 16's deleteOlderLogs finding).
		attendanceLogId: bigint("attendance_log_id", { mode: "bigint" }).references(
			() => attendanceLogs.id,
			{ onDelete: "set null" }
		),
		reason: text("reason"),
		createdByUserId: varchar("created_by_user_id").references(() => users.id),
		voidedAt: timestamp("voided_at", { withTimezone: true }),
		voidedByUserId: varchar("voided_by_user_id").references(() => users.id),
		voidReason: text("void_reason"),
		createdAt,
		updatedAt,
	},
	(table) => [
		// Includes voided rows deliberately — a waived day must never be re-created.
		uniqueIndex("uq_membership_session_usage_membership_date").on(
			table.membershipId,
			table.usageDate
		),
		index("idx_membership_session_usage_member_date").on(table.memberId, table.usageDate),
	]
);

export const membershipSessionUsageRelations = relations(membershipSessionUsage, ({ one }) => ({
	membership: one(memberMemberships, {
		fields: [membershipSessionUsage.membershipId],
		references: [memberMemberships.id],
	}),
	member: one(members, {
		fields: [membershipSessionUsage.memberId],
		references: [members.id],
	}),
	attendanceLog: one(attendanceLogs, {
		fields: [membershipSessionUsage.attendanceLogId],
		references: [attendanceLogs.id],
	}),
	createdByUser: one(users, {
		fields: [membershipSessionUsage.createdByUserId],
		references: [users.id],
		relationName: "membershipSessionUsageCreatedBy",
	}),
	voidedByUser: one(users, {
		fields: [membershipSessionUsage.voidedByUserId],
		references: [users.id],
		relationName: "membershipSessionUsageVoidedBy",
	}),
}));
