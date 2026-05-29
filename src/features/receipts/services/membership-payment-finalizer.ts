import { addDays, startOfDay } from "date-fns";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import { and, eq, lt, lte, sql } from "drizzle-orm";
import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import type { PgTransaction } from "drizzle-orm/pg-core";
import { db } from "@/drizzle/db";
import type * as schema from "@/drizzle/schema";
import {
	activityLogs,
	ledgerAccounts,
	memberMemberships,
	payments,
} from "@/drizzle/schema";
import { dateFormat } from "@/lib/helpers";
import {
	areJournalValuesBalanced,
	createJournalEntry,
} from "@/services/journal";

type Transaction = PgTransaction<
	NodePgQueryResultHKT,
	typeof schema,
	ExtractTablesWithRelations<typeof schema>
>;

type MembershipPayment = Omit<
	typeof payments.$inferSelect,
	"createdAt" | "updatedAt" | "paymentDate"
> & {
	createdAt: Date | string;
	updatedAt: Date | string;
	paymentDate: Date | string;
};

type FinalizeMembershipPaymentParams = {
	tx: Transaction;
	payment: MembershipPayment;
	reference?: string | null;
	updatePendingPayment?: boolean;
	activityLog?: {
		userId: string;
		action: string;
		description: string;
	};
};

export async function refreshMembersOverview(tx?: Transaction) {
	const connection = tx ?? db;
	await connection.execute(sql`REFRESH MATERIALIZED VIEW vw_member_overview`);
}

export async function finalizeMembershipPayment({
	tx,
	payment,
	reference,
	updatePendingPayment = true,
	activityLog,
}: FinalizeMembershipPaymentParams) {
	if (!payment.planId) {
		throw new Error("Payment is not linked to a membership plan");
	}

	const plan = await tx.query.membershipPlans.findFirst({
		where: (plans, { eq }) => eq(plans.id, payment.planId as string),
	});
	if (!plan) {
		throw new Error("Plan not found");
	}
	if (!plan.revenueAccountId) {
		throw new Error("Plan revenue account is not configured");
	}

	const bankAccount = await tx.query.ledgerAccounts.findFirst({
		columns: { id: true },
		where: eq(sql`lower(${ledgerAccounts.name})`, "mpesa wallet"),
	});

	const activeMembership = await tx.query.memberMemberships.findFirst({
		where: (memberships, { and, eq }) =>
			and(
				eq(memberships.memberId, payment.memberId),
				eq(memberships.status, "active"),
			),
		orderBy: (memberships, { desc }) => [desc(memberships.endDate)],
	});

	const paymentDate = startOfDay(new Date(payment.paymentDate));
	let startDate = paymentDate;

	if (activeMembership?.endDate) {
		const activeEndDate = startOfDay(new Date(activeMembership.endDate));
		if (activeEndDate >= paymentDate) {
			startDate = addDays(activeEndDate, 1);
		}
	}

	const today = startOfDay(new Date());
	const membershipStatus = startDate > today ? "pending" : "active";
	const endDate = addDays(startDate, plan.duration);

	await tx
		.update(memberMemberships)
		.set({ status: "expired" })
		.where(
			and(
				eq(memberMemberships.memberId, payment.memberId),
				eq(memberMemberships.status, "active"),
				lt(memberMemberships.endDate, dateFormat(paymentDate)),
			),
		);

	const [membership] = await tx
		.insert(memberMemberships)
		.values({
			memberId: payment.memberId,
			membershipPlanId: payment.planId,
			startDate: dateFormat(startDate),
			endDate: dateFormat(endDate),
			autoRenew: false,
			status: membershipStatus,
			paymentId: payment.id,
			previousMembershipPlanId: activeMembership?.membershipPlanId,
			priceCharged: payment.totalAmount,
		})
		.returning({ id: memberMemberships.id });

	if (updatePendingPayment) {
		const [updatedPayment] = await tx
			.update(payments)
			.set({
				status: "completed",
				reference: reference ?? payment.reference,
			})
			.where(and(eq(payments.id, payment.id), eq(payments.status, "pending")))
			.returning({ id: payments.id });

		if (!updatedPayment) {
			throw new Error("Payment is already processed or not pending");
		}
	}

	const description = `Payment for ${payment.paymentNo} - ${reference ?? payment.reference ?? ""}`;
	const lines: Array<{
		lineNumber: number;
		accountId: number;
		amount: string;
		dc: "credit" | "debit";
		memo: string;
	}> = [
		{
			lineNumber: 1,
			accountId: plan.revenueAccountId,
			amount: payment.lineTotal,
			dc: "credit" as const,
			memo: description,
		},
	];

	if (parseFloat(payment.taxAmount) > 0) {
		const settings = await tx.query.settings.findFirst({
			columns: { billing: true },
		});
		if (!settings?.billing?.vatAccountId) {
			throw new Error("VAT account is not configured");
		}
		lines.push({
			lineNumber: 2,
			accountId: settings.billing.vatAccountId,
			amount: payment.taxAmount,
			dc: "credit" as const,
			memo: description,
		});
	}

	lines.push({
		lineNumber: lines.length + 1,
		accountId: bankAccount?.id ?? 2,
		amount: payment.totalAmount,
		dc: "debit" as const,
		memo: description,
	});

	if (!areJournalValuesBalanced(lines)) {
		throw new Error("Journal values are not balanced");
	}

	await createJournalEntry({
		entry: {
			entryDate: dateFormat(payment.paymentDate),
			reference: payment.paymentNo,
			source: "plan payment",
			sourceId: payment.id,
			description,
		},
		lines,
		tx,
	});

	if (activityLog) {
		await tx.insert(activityLogs).values(activityLog);
	}

	// await refreshMembersOverview(tx);

	return {
		paymentId: payment.id,
		membershipId: membership.id,
		membershipStatus,
		startDate: dateFormat(startDate),
		endDate: dateFormat(endDate),
	};
}

export async function runMembershipMaintenance() {
	const today = dateFormat(new Date());

	await db.transaction(async (tx) => {
		await tx
			.update(memberMemberships)
			.set({ status: "expired" })
			.where(
				and(
					eq(memberMemberships.status, "active"),
					lt(memberMemberships.endDate, today),
				),
			);

		await tx
			.update(memberMemberships)
			.set({ status: "active" })
			.where(
				and(
					eq(memberMemberships.status, "pending"),
					lte(memberMemberships.startDate, today),
				),
			);

		await refreshMembersOverview(tx);
	});
}
