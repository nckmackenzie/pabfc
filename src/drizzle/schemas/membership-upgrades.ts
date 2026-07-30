import { relations } from "drizzle-orm";
import {
	boolean,
	date,
	integer,
	numeric,
	pgTable,
	text,
	uniqueIndex,
	varchar,
} from "drizzle-orm/pg-core";
import { createdAt, id } from "@/drizzle/schema-helpers";
import { users } from "./auth";
import { members, membershipPlans } from "./member";
import { payments } from "./payments";

// Audit/link table for the top-up upgrade flow. An "upgrade payment" isn't a
// distinct payment type — it's identified purely by joining against this table's
// `upgradePaymentId`. See `upgradePaymentFn` for the write path.
export const membershipUpgrades = pgTable(
	"membership_upgrades",
	{
		id,
		originalPaymentId: varchar("original_payment_id")
			.notNull()
			.references(() => payments.id),
		upgradePaymentId: varchar("upgrade_payment_id")
			.notNull()
			.references(() => payments.id),
		memberId: varchar("member_id")
			.notNull()
			.references(() => members.id),
		originalPlanId: varchar("original_plan_id")
			.notNull()
			.references(() => membershipPlans.id),
		newPlanId: varchar("new_plan_id")
			.notNull()
			.references(() => membershipPlans.id),
		originalEndDate: date("original_end_date"),
		newEndDate: date("new_end_date"),
		topUpAmount: numeric("top_up_amount", { precision: 18, scale: 2 }).notNull(),
		upgradeDate: date("upgrade_date").notNull(),
		notes: text("notes"),
		// Late-upgrade audit trail — set together, all three null/false for a normal
		// (not-late) upgrade. isLateUpgrade is not-null so it's always queryable
		// without a null check; daysAfterExpiry/lateUpgradeReason are only ever
		// non-null together with isLateUpgrade === true.
		isLateUpgrade: boolean("is_late_upgrade").notNull().default(false),
		daysAfterExpiry: integer("days_after_expiry"),
		lateUpgradeReason: text("late_upgrade_reason"),
		createdByUserId: varchar("created_by_user_id")
			.notNull()
			.references(() => users.id),
		createdAt,
	},
	(table) => [
		// A payment can only ever be the original side of one upgrade, and only ever
		// be the upgrade (top-up) side of one upgrade — mirrors the two-directional
		// check in checkUpgradeEligibility, enforced here at the DB level too.
		uniqueIndex("uq_membership_upgrades_original_payment_id").on(table.originalPaymentId),
		uniqueIndex("uq_membership_upgrades_upgrade_payment_id").on(table.upgradePaymentId),
	]
);

// Two FKs (originalPaymentId, upgradePaymentId) target the same `payments` table, and
// two more (originalPlanId, newPlanId) target `membershipPlans` — no existing schema
// in this codebase disambiguates that case, so each of those relations gets an
// explicit `relationName` per Drizzle's convention for resolving same-table FK pairs.
export const membershipUpgradesRelations = relations(membershipUpgrades, ({ one }) => ({
	originalPayment: one(payments, {
		fields: [membershipUpgrades.originalPaymentId],
		references: [payments.id],
		relationName: "membershipUpgradeOriginalPayment",
	}),
	upgradePayment: one(payments, {
		fields: [membershipUpgrades.upgradePaymentId],
		references: [payments.id],
		relationName: "membershipUpgradeUpgradePayment",
	}),
	member: one(members, {
		fields: [membershipUpgrades.memberId],
		references: [members.id],
	}),
	originalPlan: one(membershipPlans, {
		fields: [membershipUpgrades.originalPlanId],
		references: [membershipPlans.id],
		relationName: "membershipUpgradeOriginalPlan",
	}),
	newPlan: one(membershipPlans, {
		fields: [membershipUpgrades.newPlanId],
		references: [membershipPlans.id],
		relationName: "membershipUpgradeNewPlan",
	}),
	createdByUser: one(users, {
		fields: [membershipUpgrades.createdByUserId],
		references: [users.id],
	}),
}));
