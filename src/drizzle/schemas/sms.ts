import { relations } from "drizzle-orm";
import {
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	varchar,
} from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "@/drizzle/schema-helpers";

export const FILTER_CRITERIA = ["by status", "by plan"] as const;
export const SMS_BROADCAST_STATUS = [
	"draft",
	"sent",
	"sending",
	"failed",
] as const;

export type SMSBroadcastResponse = {
	SMSMessageData: {
		Message: string;
		Recipients: [
			{
				statusCode: number;
				number: string;
				status: string;
				cost: string;
				messageId: string;
			},
		];
	};
};

export const smsFilterCriteriaEnum = pgEnum(
	"sms_filter_criteria",
	FILTER_CRITERIA,
);
export const smsBroadcastStatusEnum = pgEnum(
	"sms_broadcast_status",
	SMS_BROADCAST_STATUS,
);

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
	broadcasts: many(smsBroadcasts),
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

export const smsBroadcasts = pgTable("sms_broadcasts", {
	id,
	filterCriteria: smsFilterCriteriaEnum("filter_criteria").notNull(),
	criteria: varchar("criteria", { length: 255 }).notNull(),
	smsTemplateId: varchar("sms_template_id").references(() => smsTemplates.id, {
		onDelete: "set null",
	}),
	content: text("message").notNull(),
	receipients: text().array().notNull(),
	smsBroadcastStatus: smsBroadcastStatusEnum("sms_broadcast_status")
		.notNull()
		.default("draft"),
	sentAt: timestamp("sent_at"),
	response: jsonb("response").$type<SMSBroadcastResponse>(),
	createdAt,
	updatedAt,
});

export const smsBroadcastsRelations = relations(smsBroadcasts, ({ one }) => ({
	template: one(smsTemplates, {
		fields: [smsBroadcasts.smsTemplateId],
		references: [smsTemplates.id],
	}),
}));

export const smsLogsRelations = relations(smsLogs, ({ one }) => ({
	template: one(smsTemplates, {
		fields: [smsLogs.templateId],
		references: [smsTemplates.id],
	}),
}));
