import { relations, sql } from "drizzle-orm";
import {
	check,
	date,
	index,
	integer,
	numeric,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	varchar,
} from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "@/drizzle/schema-helpers";
import { addonInvoices } from "./addons";
import { users } from "./auth";
import { memberMemberships, members } from "./member";
import { payments } from "./payments";

export const creditNoteStatuses = [
	"active",
	"partially_redeemed",
	"fully_redeemed",
	"expired",
] as const;
export type CreditNoteStatus = (typeof creditNoteStatuses)[number];
export const creditNoteStatusEnum = pgEnum("credit_note_status", creditNoteStatuses);

// Issued when a member's paid membership is ended early (e.g. injury) and the
// unused portion is converted into a redeemable KES account-credit balance.
// One row per terminated `memberMemberships` row — see `checkCreditNoteEligibility`.
export const creditNotes = pgTable(
	"credit_notes",
	{
		id,
		creditNoteNo: varchar("credit_note_no", { length: 50 }).notNull().unique(),
		memberId: varchar("member_id")
			.notNull()
			.references(() => members.id),
		originalPaymentId: varchar("original_payment_id")
			.notNull()
			.references(() => payments.id),
		originalMembershipId: varchar("original_membership_id")
			.notNull()
			.references(() => memberMemberships.id),
		reason: text("reason").notNull(),
		unusedDays: integer("unused_days").notNull(),
		dailyRate: numeric("daily_rate", { precision: 18, scale: 2 }).notNull(),
		suggestedAmount: numeric("suggested_amount", { precision: 18, scale: 2 }).notNull(),
		creditSubtotal: numeric("credit_subtotal", { precision: 18, scale: 2 }).notNull(),
		creditTax: numeric("credit_tax", { precision: 18, scale: 2 }).notNull().default("0"),
		amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
		balanceRemaining: numeric("balance_remaining", { precision: 18, scale: 2 }).notNull(),
		status: creditNoteStatusEnum("status").notNull().default("active"),
		expiresAt: date("expires_at").notNull(),
		issuedByUserId: varchar("issued_by_user_id")
			.notNull()
			.references(() => users.id),
		createdAt,
		updatedAt,
	},
	(table) => [
		index("credit_notes_member_id_idx").on(table.memberId),
		// A membership row can only ever be credited once — mirrors the explicit
		// "credit_notes row already exists for this originalMembershipId" guard in
		// checkCreditNoteEligibility, enforced here at the DB level too.
		uniqueIndex("uq_credit_notes_original_membership_id").on(table.originalMembershipId),
	]
);

export const creditNotesRelations = relations(creditNotes, ({ one, many }) => ({
	member: one(members, {
		fields: [creditNotes.memberId],
		references: [members.id],
	}),
	originalPayment: one(payments, {
		fields: [creditNotes.originalPaymentId],
		references: [payments.id],
	}),
	originalMembership: one(memberMemberships, {
		fields: [creditNotes.originalMembershipId],
		references: [memberMemberships.id],
	}),
	issuedByUser: one(users, {
		fields: [creditNotes.issuedByUserId],
		references: [users.id],
	}),
	redemptions: many(creditNoteRedemptions),
}));

// One row per future payment/addon-invoice a credit note's balance was drawn
// down against. Exactly one of paymentId/addonInvoiceId is set — see the FIFO
// allocator in `resolveCreditFifoAllocation` and `applyCreditRedemption`.
export const creditNoteRedemptions = pgTable(
	"credit_note_redemptions",
	{
		id,
		creditNoteId: varchar("credit_note_id")
			.notNull()
			.references(() => creditNotes.id),
		paymentId: varchar("payment_id").references(() => payments.id),
		addonInvoiceId: varchar("addon_invoice_id").references(() => addonInvoices.id),
		amountApplied: numeric("amount_applied", { precision: 18, scale: 2 }).notNull(),
		redeemedAt: timestamp("redeemed_at", { withTimezone: true }).notNull().defaultNow(),
		createdAt,
	},
	(table) => [
		index("credit_note_redemptions_credit_note_id_idx").on(table.creditNoteId),
		check(
			"chk_credit_note_redemptions_exactly_one_target",
			sql`(
				(${table.paymentId} IS NOT NULL AND ${table.addonInvoiceId} IS NULL) OR
				(${table.paymentId} IS NULL AND ${table.addonInvoiceId} IS NOT NULL)
			)`
		),
	]
);

export const creditNoteRedemptionsRelations = relations(creditNoteRedemptions, ({ one }) => ({
	creditNote: one(creditNotes, {
		fields: [creditNoteRedemptions.creditNoteId],
		references: [creditNotes.id],
	}),
	payment: one(payments, {
		fields: [creditNoteRedemptions.paymentId],
		references: [payments.id],
	}),
	addonInvoice: one(addonInvoices, {
		fields: [creditNoteRedemptions.addonInvoiceId],
		references: [addonInvoices.id],
	}),
}));
