import { and, eq, gt, isNull, ne, or } from "drizzle-orm";
import { journalEntries, memberMemberships, payments, paymentMembers } from "@/drizzle/schema";
import type { ReceiptJournalLine } from "@/features/receipts/lib/journal";
import type { Transaction } from "@/features/receipts/services/membership-payment-finalizer";
import { failure, success, type Result } from "@/lib/result";
import { areJournalValuesBalanced } from "@/services/journal";

export type VoidEligiblePayment = typeof payments.$inferSelect;

export type VoidEligibility = {
	payment: VoidEligiblePayment;
	coveredMembers: { id: string; name: string }[];
	membership: {
		startDate: string;
		endDate: string | null;
		membershipPlanId: string;
	};
};

// Re-run server-side before every void — never trust a client-side check alone.
export async function checkVoidEligibility(
	tx: Transaction,
	paymentId: string
): Promise<Result<VoidEligibility>> {
	const payment = await tx.query.payments.findFirst({
		where: eq(payments.id, paymentId),
	});

	if (!payment) {
		return failure({ type: "NotFoundError", message: "Payment not found" });
	}
	if (payment.status !== "completed") {
		return failure({
			type: "ApplicationError",
			message: `Only completed payments can be voided (current status: ${payment.status}).`,
		});
	}

	const coveredMemberRows = await tx.query.paymentMembers.findMany({
		where: eq(paymentMembers.paymentId, payment.id),
		with: {
			member: { columns: { id: true, firstName: true, lastName: true } },
		},
	});
	const coveredMembers = coveredMemberRows.map(({ member }) => ({
		id: member.id,
		name: `${member.firstName} ${member.lastName}`,
	}));

	const membershipRow = await tx.query.memberMemberships.findFirst({
		where: eq(memberMemberships.paymentId, payment.id),
		columns: { startDate: true, endDate: true, membershipPlanId: true },
	});
	if (!membershipRow) {
		return failure({
			type: "ApplicationError",
			message: "No membership record found for this payment; cannot verify void eligibility.",
		});
	}

	// A member has "renewed" if any other membership row of theirs (not created by this
	// payment) starts later than the membership this payment created.
	for (const { id: memberId, name } of coveredMembers) {
		const laterMembership = await tx.query.memberMemberships.findFirst({
			where: and(
				eq(memberMemberships.memberId, memberId),
				or(ne(memberMemberships.paymentId, payment.id), isNull(memberMemberships.paymentId)),
				gt(memberMemberships.startDate, membershipRow.startDate)
			),
			orderBy: (row, { asc }) => [asc(row.startDate)],
		});
		if (laterMembership) {
			return failure({
				type: "ConflictError",
				message: `${name} has already renewed with a later membership (${laterMembership.startDate} to ${laterMembership.endDate ?? "ongoing"}) — this payment cannot be voided.`,
			});
		}
	}

	// TODO: `membership_upgrades` doesn't exist in the schema yet. Once the Upgrade
	// feature ships, add a check here for a row with `originalPaymentId = payment.id`
	// or `upgradePaymentId = payment.id` — an upgrade mutates the existing
	// memberMemberships row in place rather than creating a new one, so the
	// "later membership" check above won't catch an upgraded payment.

	return success({ payment, coveredMembers, membership: membershipRow });
}

// Mirrors the original journal entry's actual lines (not a recompute from current
// plan/account configuration, which may have changed since the payment was made),
// flipping debit/credit so the reversal exactly undoes it.
export async function buildVoidReversalJournalLines(
	tx: Transaction,
	payment: VoidEligiblePayment
): Promise<Result<ReceiptJournalLine[]>> {
	const originalEntry = await tx.query.journalEntries.findFirst({
		where: and(eq(journalEntries.source, "plan payment"), eq(journalEntries.sourceId, payment.id)),
		with: {
			lines: { orderBy: (line, { asc }) => [asc(line.lineNumber)] },
		},
	});

	if (!originalEntry || originalEntry.lines.length === 0) {
		return failure({
			type: "NotFoundError",
			message: "Original journal entry for this payment was not found.",
		});
	}

	const reversedLines: ReceiptJournalLine[] = originalEntry.lines.map((line) => ({
		lineNumber: line.lineNumber,
		accountId: line.accountId,
		amount: line.amount,
		dc: line.dc === "debit" ? "credit" : "debit",
		memo: line.memo ?? "",
	}));

	if (!areJournalValuesBalanced(reversedLines)) {
		return failure({
			type: "ApplicationError",
			message: "Reversal journal lines are not balanced.",
		});
	}

	return success(reversedLines);
}
