import { eq, sql } from "drizzle-orm";
import { creditNoteRedemptions, creditNotes } from "@/drizzle/schema";
import type { CreditNoteStatus } from "@/drizzle/schemas/credit-notes";
import {
	type CreditFifoAllocation,
	resolveCreditFifoAllocation,
} from "@/features/credit-notes/lib/fifo";
import type { ReceiptJournalLine } from "@/features/receipts/lib/journal";
import type { Transaction } from "@/features/receipts/services/membership-payment-finalizer";
import { dateFormat, toBig, toDecimalString } from "@/lib/helpers";
import { areJournalValuesBalanced, createJournalEntry } from "@/services/journal";

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
	const totalAllocated = allocations.reduce(
		(sum, allocation) => sum.plus(allocation.amountToApply),
		toBig(0)
	);

	if (!totalAllocated.eq(amountToApply)) {
		throw new Error("Insufficient available credit");
	}

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

// Pure balance/status math for restoreCreditNoteBalance below — unit-testable
// without a DB connection. A restored credit note is always brought back to a
// redeemable status (never left "expired" with a nonzero balance) — see
// restoreCreditNoteBalance for the write-off reversal that keeps this consistent
// with the GL when the note had already been expired.
export function computeRestoredCreditNoteState({
	amount,
	balanceRemaining,
	amountToRestore,
}: {
	amount: string;
	balanceRemaining: string;
	amountToRestore: string;
}): { balanceRemaining: string; status: CreditNoteStatus } {
	const restored = toBig(balanceRemaining).plus(amountToRestore);
	const capped = restored.gt(amount) ? toBig(amount) : restored;
	const status: CreditNoteStatus = capped.gte(amount) ? "active" : "partially_redeemed";

	return { balanceRemaining: toDecimalString(capped), status };
}

// Void's "subsidiary ledger and GL must both move together" fix-up (Step 11): adds
// `amountToRestore` back onto a credit note's balance and recomputes its status.
//
// If the note had already expired (expireCreditNotes wrote off its balance and
// zeroed it — see credit-note.maintenance.ts), restoring a balance into it without
// also touching the GL would leave a credit note sitting "expired" with a nonzero
// balance: unreachable by both the FIFO redemption query and the expiry job (both
// filter to active/partially_redeemed), and unreconciled against the GL, which
// still shows the full original write-off as forfeited income. So in that case
// this also posts the exact inverse of the write-off journal for the restored
// amount — DR the forfeiture income back out, CR the payable liability back in —
// and un-expires the note, atomically with the balance/status update.
export async function restoreCreditNoteBalance(
	tx: Transaction,
	creditNoteId: string,
	amountToRestore: string
) {
	const creditNoteRef = await tx.query.creditNotes.findFirst({
		where: eq(creditNotes.id, creditNoteId),
		columns: { memberId: true },
	});
	if (!creditNoteRef) return;

	// Lock before the authoritative read below (not just before the final write) so
	// this function is safe to call on its own — voidPaymentFn already locks by
	// member before looping over redemptions, but that's caller discipline this
	// function shouldn't have to rely on; re-entrant within the same tx (Postgres
	// advisory xact locks stack per session), so locking again here is a no-op when
	// the caller already holds it.
	await lockMemberCredits(tx, creditNoteRef.memberId);

	const creditNote = await tx.query.creditNotes.findFirst({
		where: eq(creditNotes.id, creditNoteId),
		columns: { creditNoteNo: true, amount: true, balanceRemaining: true, status: true },
	});
	if (!creditNote) return;

	const { balanceRemaining, status } = computeRestoredCreditNoteState({
		amount: creditNote.amount,
		balanceRemaining: creditNote.balanceRemaining,
		amountToRestore,
	});

	if (creditNote.status === "expired" && toBig(amountToRestore).gt(0)) {
		const settings = await tx.query.settings.findFirst({ columns: { billing: true } });
		const payableAccountId = settings?.billing?.memberCreditsPayableAccountId;
		const forfeitureAccountId = settings?.billing?.creditForfeitureIncomeAccountId;
		if (!payableAccountId || !forfeitureAccountId) {
			throw new Error(
				"Cannot restore credit note balance: member credits payable / credit forfeiture income account is not configured."
			);
		}

		const today = dateFormat(new Date());
		const description = `Reversal of credit note ${creditNote.creditNoteNo}'s expiry write-off — KES ${amountToRestore} restored after a redeeming payment was voided.`;
		const lines: ReceiptJournalLine[] = [
			{
				lineNumber: 1,
				accountId: forfeitureAccountId,
				amount: amountToRestore,
				dc: "debit",
				memo: description,
			},
			{
				lineNumber: 2,
				accountId: payableAccountId,
				amount: amountToRestore,
				dc: "credit",
				memo: description,
			},
		];
		if (!areJournalValuesBalanced(lines)) {
			throw new Error("Credit note expiry-reversal journal values are not balanced");
		}

		await createJournalEntry({
			entry: {
				entryDate: today,
				reference: creditNote.creditNoteNo,
				source: "credit note expiry reversal",
				sourceId: creditNoteId,
				description,
			},
			lines,
			tx,
		});
	}

	await tx
		.update(creditNotes)
		.set({ balanceRemaining, status })
		.where(eq(creditNotes.id, creditNoteId));
}
