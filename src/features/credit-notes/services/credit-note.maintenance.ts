import { and, eq, inArray, lt } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { creditNotes } from "@/drizzle/schema";
import { lockMemberCredits } from "@/features/credit-notes/lib/redemption";
import type { ReceiptJournalLine } from "@/features/receipts/lib/journal";
import { dateFormat, toBig } from "@/lib/helpers";
import { createJournalEntry } from "@/services/journal";

const REDEEMABLE_STATUSES = ["active", "partially_redeemed"] as const;

// Writes off any credit note that has passed its expiresAt date and is still
// unredeemed (in full or in part) — DR the credits-payable liability, CR the
// forfeiture income account, for the outstanding balance, then flip it to
// "expired" with a zeroed balance. Called from the daily cron (see
// src/routes/api/cron/daily/index.ts) alongside the other status-rollover jobs.
export async function expireCreditNotes() {
	const today = dateFormat(new Date());

	// Candidate list only — read outside the transaction, so it can go stale by the
	// time each row is actually processed below (a concurrent redemption or another
	// cron run could touch it first). Every row is re-locked and re-read against its
	// current, committed state before anything is written.
	const candidates = await db.query.creditNotes.findMany({
		where: and(inArray(creditNotes.status, REDEEMABLE_STATUSES), lt(creditNotes.expiresAt, today)),
		columns: { id: true, memberId: true },
	});
	if (candidates.length === 0) return;

	const settings = await db.query.settings.findFirst({ columns: { billing: true } });
	const payableAccountId = settings?.billing?.memberCreditsPayableAccountId;
	const forfeitureAccountId = settings?.billing?.creditForfeitureIncomeAccountId;
	if (!payableAccountId || !forfeitureAccountId) {
		// Both are single, gym-wide settings — if either is missing, no expiry can be
		// written off correctly, so the whole batch is skipped (not silently written off
		// without a journal entry) until an admin configures them.
		console.error(
			"Credit note expiry skipped: member credits payable / credit forfeiture income account is not configured."
		);
		return;
	}

	await db.transaction(async (tx) => {
		for (const candidate of candidates) {
			// Same lock namespace applyCreditRedemption uses — serializes this write-off
			// against a concurrent redemption of the same member's balance, and against a
			// second concurrent cron run processing the same candidate list.
			await lockMemberCredits(tx, candidate.memberId);

			const creditNote = await tx.query.creditNotes.findFirst({
				where: eq(creditNotes.id, candidate.id),
			});
			if (!creditNote) continue;
			// Re-check against the fresh, post-lock read — a redemption or an earlier
			// iteration of a concurrent cron run may have already moved this row past
			// what the candidate list saw (fully redeemed, already expired, or no longer
			// past its expiry date).
			if (
				!REDEEMABLE_STATUSES.includes(creditNote.status as (typeof REDEEMABLE_STATUSES)[number]) ||
				creditNote.expiresAt >= today
			) {
				continue;
			}

			if (toBig(creditNote.balanceRemaining).gt(0)) {
				const description = `Credit note ${creditNote.creditNoteNo} expired unredeemed on ${today} — writing off balance of KES ${creditNote.balanceRemaining}.`;
				const lines: ReceiptJournalLine[] = [
					{
						lineNumber: 1,
						accountId: payableAccountId,
						amount: creditNote.balanceRemaining,
						dc: "debit",
						memo: description,
					},
					{
						lineNumber: 2,
						accountId: forfeitureAccountId,
						amount: creditNote.balanceRemaining,
						dc: "credit",
						memo: description,
					},
				];
				await createJournalEntry({
					entry: {
						entryDate: today,
						reference: creditNote.creditNoteNo,
						source: "credit note expiry",
						sourceId: creditNote.id,
						description,
					},
					lines,
					tx,
				});
			}

			await tx
				.update(creditNotes)
				.set({ status: "expired", balanceRemaining: "0.00" })
				.where(eq(creditNotes.id, creditNote.id));
		}
	});
}
