import { relations } from "drizzle-orm";
import { date, index, integer, pgEnum, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "@/drizzle/schema-helpers";
import { users } from "./auth";
import { members, membershipPlans } from "./member";
import { payments } from "./payments";

export const complimentaryRequestStatuses = ["pending", "approved", "rejected"] as const;
export type ComplimentaryRequestStatus = (typeof complimentaryRequestStatuses)[number];
export const complimentaryRequestStatusEnum = pgEnum(
	"complimentary_request_status",
	complimentaryRequestStatuses
);

export const complimentaryMembershipRequests = pgTable(
	"complimentary_membership_requests",
	{
		id,
		memberId: varchar("member_id").notNull().references(() => members.id),
		planId: varchar("plan_id").notNull().references(() => membershipPlans.id),
		startDate: date("start_date").notNull(),
		numberOfPeriods: integer("number_of_periods").notNull().default(1),
		reason: text("reason").notNull(),
		status: complimentaryRequestStatusEnum("status").notNull().default("pending"),
		requestedByUserId: varchar("requested_by_user_id").notNull().references(() => users.id),
		reviewedByUserId: varchar("reviewed_by_user_id").references(() => users.id),
		reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
		rejectionReason: text("rejection_reason"),
		resultingPaymentId: varchar("resulting_payment_id").references(() => payments.id),
		createdAt,
		updatedAt,
	},
	(table) => [
		index("idx_complimentary_requests_status").on(table.status),
		index("idx_complimentary_requests_member_id").on(table.memberId),
	]
);

export const complimentaryMembershipRequestsRelations = relations(
	complimentaryMembershipRequests,
	({ one }) => ({
		member: one(members, {
			fields: [complimentaryMembershipRequests.memberId],
			references: [members.id],
		}),
		plan: one(membershipPlans, {
			fields: [complimentaryMembershipRequests.planId],
			references: [membershipPlans.id],
		}),
		requestedByUser: one(users, {
			fields: [complimentaryMembershipRequests.requestedByUserId],
			references: [users.id],
		}),
		reviewedByUser: one(users, {
			fields: [complimentaryMembershipRequests.reviewedByUserId],
			references: [users.id],
		}),
		resultingPayment: one(payments, {
			fields: [complimentaryMembershipRequests.resultingPaymentId],
			references: [payments.id],
		}),
	})
);
