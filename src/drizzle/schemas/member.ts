import { relations } from "drizzle-orm";
import {
	boolean,
	date,
	index,
	integer,
	numeric,
	pgEnum,
	pgMaterializedView,
	pgTable,
	text,
	timestamp,
	varchar,
} from "drizzle-orm/pg-core";
import { active, createdAt, id, updatedAt } from "@/drizzle/schema-helpers";
import { attendanceLogs } from "./attendance";
import { ledgerAccounts } from "./chart-of-accounts";
import { customerInvoices, payments } from "./payments";

export const gender = ["male", "female", "unspecified", "other"] as const;
export type Gender = (typeof gender)[number];
export const genderEnum = pgEnum("gender", gender);

export const memberStatus = [
	"active",
	"inactive",
	"frozen",
	"terminated",
] as const;
export type MemberStatus = (typeof memberStatus)[number];
export const memberStatusEnum = pgEnum("member_status", memberStatus);

export const membershipStatus = [
	"active",
	"inactive",
	"frozen",
	"terminated",
	"expired",
	"pending",
	"cancelled",
	"suspended",
	"",
] as const;
export type MembershipStatus = (typeof membershipStatus)[number];
export const membershipStatusEnum = pgEnum(
	"membership_status",
	membershipStatus,
);

export const members = pgTable(
	"members",
	{
		id,
		memberNo: integer("member_no").notNull().unique().default(0),
		firstName: varchar("first_name").notNull(),
		lastName: varchar("last_name").notNull(),
		dateOfBirth: date("date_of_birth"),
		gender: genderEnum("gender").notNull().default("unspecified"),
		email: varchar("email").unique(),
		contact: varchar("contact", { length: 15 }).unique(),
		idType: varchar("id_type", { length: 20 }),
		idNumber: varchar("id_number", { length: 20 }).unique(),
		memberStatus: memberStatusEnum("member_status").notNull().default("active"),
		address: varchar("address", { length: 255 }),
		city: varchar("city", { length: 100 }),
		state: varchar("state", { length: 100 }),
		zipCode: varchar("zip_code", { length: 20 }),
		country: varchar("country", { length: 100 }),
		emergencyContactName: varchar("emergency_contact_name", { length: 100 }),
		emergencyContactNo: varchar("emergency_contact_no", {
			length: 15,
		}),
		emergencyContactRelationship: varchar("emergency_contact_relationship", {
			length: 100,
		}),
		deviceId: varchar("device_id", { length: 255 }),
		notes: text("notes"),
		image: varchar("image", { length: 255 }),
		deletedAt: timestamp("deleted_at"),
		deactivatedAt: timestamp("deactivated_at"),
		createdAt,
		updatedAt,
	},
	(table) => [
		index("idx_member_first_name").on(table.firstName),
		index("idx_member_last_name").on(table.lastName),
		index("idx_member_status").on(table.memberStatus),
	],
);

export const memberRelations = relations(members, ({ many }) => ({
	memberships: many(memberMemberships),
	attendances: many(attendanceLogs),
	invoices: many(customerInvoices),
	payments: many(payments),
}));

export const membershipPlans = pgTable(
	"membership_plans",
	{
		id,
		name: varchar("name").notNull(),
		description: text("description"),
		duration: integer("duration").notNull(),
		isSessionBased: boolean("is_session_based").notNull().default(false),
		sessionCount: integer("session_count").notNull().default(0),
		price: integer("price").notNull().default(0),
		validFrom: date("valid_from"),
		validTo: date("valid_to"),
		revenueAccountId: integer("revenue_account_id").references(
			() => ledgerAccounts.id,
		),
		active,
		createdAt,
		updatedAt,
	},
	(table) => [index("idx_membership_plan_name").on(table.name)],
);

export const mebershipPlansRelations = relations(
	membershipPlans,
	({ many }) => ({
		members: many(memberMemberships),
		payments: many(payments),
	}),
);

export const memberMemberships = pgTable(
	"member_memberships",
	{
		id,
		memberId: varchar("member_id")
			.notNull()
			.references(() => members.id, { onDelete: "cascade" }),
		membershipPlanId: varchar("membership_plan_id")
			.notNull()
			.references(() => membershipPlans.id, { onDelete: "restrict" }),
		startDate: date("start_date").notNull(),
		endDate: date("end_date"),
		status: membershipStatusEnum("status").notNull().default("active"),
		autoRenew: boolean("auto_renew").notNull().default(false),
		freezeStartDate: date("freeze_start_date"),
		freezeEndDate: date("freeze_end_date"),
		freezeReason: varchar("freeze_reason", { length: 255 }),
		terminatedAt: date("terminated_at"),
		terminatedReason: varchar("terminated_reason", { length: 255 }),
		priceCharged: numeric("price_charged", { precision: 10, scale: 2 }),
		invoiceId: varchar("invoice_id", { length: 255 }),
		paymentId: varchar("payment_id", { length: 255 }),
		previousMembershipPlanId: varchar("previous_membership_plan_id", {
			length: 255,
		}),
		createdAt,
		updatedAt,
	},
	(table) => [
		index("idx_member_membership_member_id").on(table.memberId),
		index("idx_member_membership_membership_plan_id").on(
			table.membershipPlanId,
		),
	],
);

export const memberMembershipsRelations = relations(
	memberMemberships,
	({ one }) => ({
		member: one(members, {
			fields: [memberMemberships.memberId],
			references: [members.id],
		}),
		membershipPlan: one(membershipPlans, {
			fields: [memberMemberships.membershipPlanId],
			references: [membershipPlans.id],
		}),
	}),
);

export const membersOverview = pgMaterializedView("vw_member_overview", {
	id: varchar("id").notNull(),
	memberNo: integer("member_no").notNull(),
	firstName: varchar("first_name").notNull(),
	lastName: varchar("last_name").notNull(),
	fullName: varchar("full_name").notNull(),
	contact: varchar("contact", { length: 15 }).unique(),
	gender: genderEnum("gender").notNull(),
	memberStatus: memberStatusEnum("member_status").notNull(),
	image: varchar("image"),
	activePlanName: varchar("active_plan_name"),
	nextRenewalDate: date("next_renewal_date"),
	lastVisit: timestamp("last_visit"),
	notes: text("notes"),
	emergencyContactName: varchar("emergency_contact_name", { length: 100 }),
	emergencyContactNo: varchar("emergency_contact_no", {
		length: 15,
	}),
	banned: boolean("banned").notNull().default(false),
	createdAt,
}).existing();
