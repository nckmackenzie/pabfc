import { relations } from "drizzle-orm";
import { index, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { id } from "../schema-helpers";
import { users } from "./auth";

export const activityLogs = pgTable(
	"activity_logs",
	{
		id,
		userId: varchar("user_id")
			.notNull()
			.references(() => users.id),
		activityDate: timestamp("activity_date", { mode: "string" })
			.notNull()
			.defaultNow(),
		action: varchar("action").notNull(),
		ipAddress: varchar("ip_address", { length: 45 }),
		description: varchar("description").notNull(),
		userAgent: varchar("user_agent"),
		os: varchar("os", { length: 100 }),
	},
	(table) => [index("activity_logs_user_id_idx").on(table.userId)],
);

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
	user: one(users, {
		fields: [activityLogs.userId],
		references: [users.id],
	}),
}));
