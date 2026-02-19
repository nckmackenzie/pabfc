import { relations } from "drizzle-orm";
import { jsonb, pgEnum, pgTable, text } from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "@/drizzle/schema-helpers";
import { users } from "./auth";

export const vatTypes = ["none", "inclusive", "exclusive"] as const;
export type VatType = (typeof vatTypes)[number];
export const vatTypeEnum = pgEnum("vat_type", vatTypes);

export const settings = pgTable("settings", {
	id,
	data: jsonb("data_privacy")
		.default({
			logRetentionDays: 180,
		})
		.$type<{
			logRetentionDays?: number;
			inactiveUserDays?: number;
			inactiveUserDeleteDays?: number;
			inactiveMemberDays?: number;
			inactiveMemberDeleteDays?: number;
		}>(),
	notification: jsonb("notification").default({}).$type<{
		enableSmsNotifications?: boolean;
		daysBeforeRenewalReminder?: number;
		sendPaymentReceiptByEmail?: boolean;
	}>(),
	security: jsonb("security").default({}).$type<{
		require2FaStaff?: boolean;
		lockAfterAttempts?: number;
		lockDurationMinutes?: number;
	}>(),
	billing: jsonb().default({}).$type<{
		invoicePrefix?: string;
		invoiceNumberPadding?: number;
		applyTaxToMembership?: boolean;
		vatType?: VatType;
		vatAccountId?: number;
		autoCreateFinancialYear?: boolean;
	}>(),
	createdAt,
	updatedAt,
	createdBy: text("created_by")
		.references(() => users.id)
		.notNull(),
	updatedBy: text("updated_by").references(() => users.id),
});

export const settingsRelations = relations(settings, ({ one }) => ({
	creator: one(users, { fields: [settings.createdBy], references: [users.id] }),
	updater: one(users, { fields: [settings.updatedBy], references: [users.id] }),
}));
