import { relations } from "drizzle-orm";
import { index, pgTable, serial, varchar } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const activityLogs = pgTable(
	"activity_logs",
	{
		id: serial("id").primaryKey().notNull(),
		userId: varchar("user_id")
			.notNull()
			.references(() => users.id),
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
