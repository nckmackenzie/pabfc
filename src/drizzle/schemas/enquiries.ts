import { sql } from "drizzle-orm";
import {
	boolean,
	date,
	index,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	varchar,
} from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "@/drizzle/schema-helpers";
import { users } from "./auth";
import { employees } from "./employees";
import { members, membershipPlans } from "./member";
import { payments } from "./payments";

export const ENQUIRY_STATUSES = ["new", "contacted", "registered", "converted", "lost"] as const;
export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];
export const enquiryStatusEnum = pgEnum("enquiry_status", ENQUIRY_STATUSES);

// Statuses in which an enquiry is still being worked: at most one per phone.
export const OPEN_ENQUIRY_STATUSES = [
	"new",
	"contacted",
] as const satisfies readonly EnquiryStatus[];

export const ENQUIRY_SOURCES = [
	"walk_in",
	"phone_call",
	"whatsapp",
	"instagram",
	"facebook",
	"tiktok",
	"google",
	"website",
	"referral",
	"flyer_signage",
	"other",
] as const;
export type EnquirySource = (typeof ENQUIRY_SOURCES)[number];
export const enquirySourceEnum = pgEnum("enquiry_source", ENQUIRY_SOURCES);

export const ENQUIRY_LOST_REASONS = [
	"price",
	"location",
	"schedule",
	"joined_other_gym",
	"no_response",
	"not_interested",
	"other",
] as const;
export type EnquiryLostReason = (typeof ENQUIRY_LOST_REASONS)[number];
export const enquiryLostReasonEnum = pgEnum("enquiry_lost_reason", ENQUIRY_LOST_REASONS);

export const enquiries = pgTable(
	"enquiries",
	{
		id,
		firstName: varchar("first_name", { length: 100 }).notNull(),
		// Optional here; becomes required when the enquiry is converted to a member.
		lastName: varchar("last_name", { length: 100 }),
		// Canonical +254XXXXXXXXX only (see normalizeKenyanPhone).
		phone: varchar("phone", { length: 13 }).notNull(),
		email: varchar("email", { length: 255 }),
		source: enquirySourceEnum("source").notNull(),
		// Free text qualifying the source, e.g. who referred them.
		sourceNotes: varchar("source_notes", { length: 255 }),
		interestedPlanId: varchar("interested_plan_id").references(() => membershipPlans.id, {
			onDelete: "set null",
		}),
		notes: text("notes"),
		status: enquiryStatusEnum("status").notNull().default("new"),
		lostReason: enquiryLostReasonEnum("lost_reason"),
		lostReasonNotes: varchar("lost_reason_notes", { length: 255 }),
		followUpDate: date("follow_up_date"),
		assignedEmployeeId: varchar("assigned_employee_id").references(() => employees.id, {
			onDelete: "set null",
		}),
		smsConsent: boolean("sms_consent").notNull().default(false),
		smsConsentAt: timestamp("sms_consent_at", { withTimezone: true }),
		// Set only by the conversion flow, never edited manually.
		convertedMemberId: varchar("converted_member_id").references(() => members.id),
		registeredAt: timestamp("registered_at", { withTimezone: true }),
		convertedPaymentId: varchar("converted_payment_id").references(() => payments.id),
		convertedAt: timestamp("converted_at", { withTimezone: true }),
		createdByUserId: varchar("created_by_user_id").references(() => users.id),
		updatedByUserId: varchar("updated_by_user_id").references(() => users.id),
		createdAt,
		updatedAt,
		deletedAt: timestamp("deleted_at", { withTimezone: true }),
	},
	(table) => [
		index("idx_enquiries_status").on(table.status),
		index("idx_enquiries_follow_up_date").on(table.followUpDate),
		index("idx_enquiries_created_at").on(table.createdAt),
		index("idx_enquiries_assigned_employee_id").on(table.assignedEmployeeId),
		index("idx_enquiries_converted_member_id").on(table.convertedMemberId),
		// One open enquiry per phone. Also what makes concurrent creates race-safe.
		uniqueIndex("uq_enquiries_open_phone")
			.on(table.phone)
			.where(sql`${table.status} IN ('new', 'contacted') AND ${table.deletedAt} IS NULL`),
	]
);

export type Enquiry = typeof enquiries.$inferSelect;
