import { eq, sql } from "drizzle-orm";
import { creditNoteRedemptions, creditNotes } from "@/drizzle/schema";
import type { CreditNoteStatus } from "@/drizzle/schemas/credit-notes";
import {
	type CreditFifoAllocation,
	resolveCreditFifoAllocation,
} from "@/features/credit-notes/lib/fifo";
import type { Transaction } from "@/features/receipts/services/membership-payment-finalizer";
import { toBig, toDecimalString } from "@/lib/helpers";

// New lock namespace alongside lockMemberMembershipCreation's 'member_memberships' one
// (see payment.mutations.api.ts) — nothing else in the codebase currently serializes
// concurrent writers against a member's credit balance, so redemption needs its own.
export async function lockMemberCredits(tx: Transaction, memberId: string) {
	await tx.execute(
		sql`select pg_advisory_xact_lock(hashtext('credit_notes'), hashtext(${memberId}))`
	);
}

type ApplyCreditRedemptionParams = {
	tx: Transaction;
	memberId: string;
	amountToApply: string;
	paymentId?: string;
	addonInvoiceId?: string;
};

// Shared by finalizeMembershipPayment and createAddonOnlyPaymentFn. Locks the
// member's credit notes, resolves the FIFO allocation, then persists one
// credit_note_redemptions row per credit note drawn from and decrements each
// credit note's balanceRemaining. Callers build the journal's credit-applied DR
// line from `amountToApply` themselves — this only touches the subsidiary ledger.
export async function applyCreditRedemption({
	tx,
	memberId,
	amountToApply,
	paymentId,
	addonInvoiceId,
}: ApplyCreditRedemptionParams): Promise<CreditFifoAllocation[]> {
	if ((paymentId ? 1 : 0) + (addonInvoiceId ? 1 : 0) !== 1) {
		throw new Error("applyCreditRedemption requires exactly one of paymentId/addonInvoiceId");
	}

	await lockMemberCredits(tx, memberId);

	const allocations = await resolveCreditFifoAllocation(tx, memberId, amountToApply);

	for (const allocation of allocations) {
		const creditNote = await tx.query.creditNotes.findFirst({
			where: eq(creditNotes.id, allocation.creditNoteId),
			columns: { balanceRemaining: true },
		});
		if (!creditNote) continue;

		await tx.insert(creditNoteRedemptions).values({
			creditNoteId: allocation.creditNoteId,
			paymentId: paymentId ?? null,
			addonInvoiceId: addonInvoiceId ?? null,
			amountApplied: allocation.amountToApply,
		});

		const newBalance = toBig(creditNote.balanceRemaining).minus(allocation.amountToApply);
		await tx
			.update(creditNotes)
			.set({
				balanceRemaining: toDecimalString(newBalance),
				status: newBalance.lte(0) ? "fully_redeemed" : "partially_redeemed",
			})
			.where(eq(creditNotes.id, allocation.creditNoteId));
	}

	return allocations;
}

// Pure status-transition math for restoreCreditNoteBalance below — unit-testable
// without a DB connection. Known limitation: if the credit note expired (and was
// written off) between the original redemption and this void, this still restores
// the balance but leaves the existing "expired" status alone — reviving it as
// spendable would need a manual correction alongside reversing the expiry
// write-off journal, which is out of scope here.
export function computeRestoredCreditNoteState({
	amount,
	balanceRemaining,
	status,
	amountToRestore,
}: {
	amount: string;
	balanceRemaining: string;
	status: CreditNoteStatus;
	amountToRestore: string;
}): { balanceRemaining: string; status: CreditNoteStatus } {
	const restored = toBig(balanceRemaining).plus(amountToRestore);
	const capped = restored.gt(amount) ? toBig(amount) : restored;

	const newStatus: CreditNoteStatus =
		status === "expired" ? status : capped.gte(amount) ? "active" : "partially_redeemed";

	return { balanceRemaining: toDecimalString(capped), status: newStatus };
}

// Void's "subsidiary ledger and GL must both move together" fix-up (Step 11): adds
// `amountToRestore` back onto a credit note's balance and recomputes its status.
export async function restoreCreditNoteBalance(
	tx: Transaction,
	creditNoteId: string,
	amountToRestore: string
) {
	const creditNote = await tx.query.creditNotes.findFirst({
		where: eq(creditNotes.id, creditNoteId),
		columns: { amount: true, balanceRemaining: true, status: true },
	});
	if (!creditNote) return;

	const { balanceRemaining, status } = computeRestoredCreditNoteState({
		amount: creditNote.amount,
		balanceRemaining: creditNote.balanceRemaining,
		status: creditNote.status,
		amountToRestore,
	});

	await tx
		.update(creditNotes)
		.set({ balanceRemaining, status })
		.where(eq(creditNotes.id, creditNoteId));
}
