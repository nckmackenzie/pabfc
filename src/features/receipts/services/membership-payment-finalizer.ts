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
	bankAccounts,
} from "@/drizzle/schema";
import { dateFormat } from "@/lib/helpers";
import { computeMembershipEndDate, parseCalendarDate } from "@/features/receipts/lib/helpers";
import { areJournalValuesBalanced, createJournalEntry } from "@/services/journal";
import { failure, success } from "@/lib/result";
import { createBankingEntry } from "@/services/banking";

export type Transaction = PgTransaction<
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
	// When provided (manual payment path), the caller-supplied, already-overlap-checked
	// start date is used directly, skipping the legacy active-membership recompute below.
	// Left undefined by the STK/Inngest path, which keeps the original recompute behavior.
	startDate?: Date | string;
	numberOfPeriods?: number;
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
	startDate: paramStartDate,
	numberOfPeriods,
	activityLog,
}: FinalizeMembershipPaymentParams) {
	if (!payment.planId) {
		return failure({
			type: "ApplicationError",
			message: "Payment is not linked to a membership plan",
		});
	}

	const plan = await tx.query.membershipPlans.findFirst({
		where: (plans, { eq }) => eq(plans.id, payment.planId as string),
	});
	if (!plan) {
		return failure({ type: "NotFoundError", message: "Plan not found" });
	}
	if (!plan.revenueAccountId) {
		return failure({ type: "ApplicationError", message: "Plan revenue account is not configured" });
	}

	// Fetch settings once — used for both bank account resolution and VAT below.
	const settings = await tx.query.settings.findFirst({
		columns: { billing: true },
	});

	let hasSettlementAccount = false;
	let bankAccount: number;

	if (settings?.billing?.mpesaSettlementAccountId) {
		hasSettlementAccount = true;
		bankAccount = settings.billing.mpesaSettlementAccountId;
	} else {
		const fetchedAccount = await tx.query.ledgerAccounts.findFirst({
			columns: { id: true },
			where: eq(sql`lower(${ledgerAccounts.name})`, "cash at bank"),
		});
		if (!fetchedAccount) {
			return failure({ type: "ApplicationError", message: "No bank account configured for payments" });
		}
		bankAccount = fetchedAccount.id;
	}

	// Validate and build journal lines before any writes so that a validation
	// failure doesn't leave the transaction in a partial state.
	const hasTax = parseFloat(payment.taxAmount) > 0;
	if (hasTax && !settings?.billing?.vatAccountId) {
		return failure({ type: "ApplicationError", message: "VAT account is not configured" });
	}

	const description = `Payment for receipt # ${payment.paymentNo} - ${reference ?? payment.reference ?? ""}`;
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

	if (hasTax) {
		lines.push({
			lineNumber: 2,
			accountId: settings!.billing!.vatAccountId!,
			amount: payment.taxAmount,
			dc: "credit" as const,
			memo: description,
		});
	}

	lines.push({
		lineNumber: lines.length + 1,
		accountId: bankAccount,
		amount: payment.totalAmount,
		dc: "debit" as const,
		memo: description,
	});

	if (!areJournalValuesBalanced(lines)) {
		return failure({ type: "ApplicationError", message: "Journal values are not balanced" });
	}

	const periods = numberOfPeriods ?? 1;
	let startDate: Date;

	if (paramStartDate) {
		// Manual payment path: trust the caller-supplied, already-overlap-checked date.
		startDate = startOfDay(parseCalendarDate(paramStartDate));
	} else {
		// Unchanged legacy path — still used by the STK/Inngest flow.
		const activeMembership = await tx.query.memberMemberships.findFirst({
			where: (memberships, { and, eq }) =>
				and(eq(memberships.memberId, payment.memberId), eq(memberships.status, "active")),
			orderBy: (memberships, { desc }) => [desc(memberships.endDate)],
		});

		const paymentDate = startOfDay(new Date(payment.paymentDate));
		startDate = paymentDate;

		if (activeMembership?.endDate) {
			const activeEndDate = startOfDay(parseCalendarDate(activeMembership.endDate));
			if (activeEndDate >= paymentDate) {
				startDate = addDays(activeEndDate, 1);
			}
		}
	}

	const today = startOfDay(new Date());
	const membershipStatus = startDate > today ? "pending" : "active";
	const endDate = computeMembershipEndDate(startDate, plan.duration, periods);

	await tx
		.update(memberMemberships)
		.set({ status: "expired" })
		.where(
			and(
				eq(memberMemberships.memberId, payment.memberId),
				eq(memberMemberships.status, "active"),
				lt(memberMemberships.endDate, dateFormat(startOfDay(new Date(payment.paymentDate))))
			)
		);

	const mostRecentMembership = await tx.query.memberMemberships.findFirst({
		where: eq(memberMemberships.memberId, payment.memberId),
		orderBy: (memberships, { desc }) => [desc(memberships.endDate)],
	});

	await tx
		.insert(memberMemberships)
		.values({
			memberId: payment.memberId,
			membershipPlanId: payment.planId,
			startDate: dateFormat(startDate),
			endDate: dateFormat(endDate),
			autoRenew: false,
			status: membershipStatus,
			paymentId: payment.id,
			previousMembershipPlanId: mostRecentMembership?.membershipPlanId,
			priceCharged: payment.totalAmount,
		});

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

	if (hasSettlementAccount) {
		const bankAccountId = await tx.query.bankAccounts.findFirst({
			columns: { id: true },
			where: eq(bankAccounts.accountId, bankAccount),
		});
		if (bankAccountId?.id) {
			await createBankingEntry({
				tx,
				entry: {
					bankId: bankAccountId.id,
					dc: "debit",
					amount: payment.totalAmount,
					reference: payment.reference ?? payment.paymentNo,
					transactionDate: dateFormat(payment.paymentDate),
					source: "plan payment",
					sourceId: payment.id,
					narration: description,
				},
			});
		}
	}

	if (activityLog) {
		await tx.insert(activityLogs).values(activityLog);
	}

	// await refreshMembersOverview(tx);

	return success(undefined);
}

export async function runMembershipMaintenance() {
	const today = dateFormat(new Date());

	await db.transaction(async (tx) => {
		await tx
			.update(memberMemberships)
			.set({ status: "expired" })
			.where(and(eq(memberMemberships.status, "active"), lt(memberMemberships.endDate, today)));

		await tx
			.update(memberMemberships)
			.set({ status: "active" })
			.where(and(eq(memberMemberships.status, "pending"), lte(memberMemberships.startDate, today)));

		await refreshMembersOverview(tx);
	});
}
