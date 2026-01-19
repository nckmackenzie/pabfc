import { relations } from "drizzle-orm";
import {
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	varchar,
} from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "@/drizzle/schema-helpers";

export const smsTemplates = pgTable(
	"sms_templates",
	{
		id,
		name: varchar("name", { length: 255 }).notNull(),
		content: text("content").notNull(),
		variables: jsonb("variables").$type<string[]>().default([]),
		description: text("description"),
		createdAt,
		updatedAt,
	},
	(table) => [uniqueIndex("name").on(table.name)],
);

export const smsTemplatesRelations = relations(smsTemplates, ({ many }) => ({
	logs: many(smsLogs),
}));

export const smsLogs = pgTable("sms_logs", {
	id,
	templateId: varchar("template_id").references(() => smsTemplates.id, {
		onDelete: "set null",
	}),
	message: text("message").notNull(),
	receipients: text().array().notNull(),
	sentAt: timestamp("sent_at").notNull(),
});

export const smsLogsRelations = relations(smsLogs, ({ one }) => ({
	template: one(smsTemplates, {
		fields: [smsLogs.templateId],
		references: [smsTemplates.id],
	}),
}));
