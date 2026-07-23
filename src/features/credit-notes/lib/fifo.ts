import { and, eq, gt, gte, inArray } from "drizzle-orm";
import { creditNotes } from "@/drizzle/schema";
import type { DbClient } from "@/features/receipts/lib/eligibility";
import { dateFormat, toBig, toDecimalString } from "@/lib/helpers";

// A credit note is spendable while its status hasn't reached a terminal state and
// it hasn't passed expiresAt yet — even if the Step 7 maintenance job hasn't run
// today to flip a past-due row's status to "expired" yet, it must not be treated
// as spendable here.
const REDEEMABLE_STATUSES = ["active", "partially_redeemed"] as const;

function redeemableCreditNotesWhere(memberId: string, today: string) {
	return and(
		eq(creditNotes.memberId, memberId),
		inArray(creditNotes.status, REDEEMABLE_STATUSES),
		gt(creditNotes.balanceRemaining, "0"),
		gte(creditNotes.expiresAt, today)
	);
}

export async function getAvailableCreditBalance(dbOrTx: DbClient, memberId: string) {
	const rows = await dbOrTx.query.creditNotes.findMany({
		where: redeemableCreditNotesWhere(memberId, dateFormat(new Date())),
		columns: { balanceRemaining: true },
	});
	return toDecimalString(rows.reduce((sum, row) => sum.plus(row.balanceRemaining), toBig(0)));
}

export type CreditFifoAllocation = { creditNoteId: string; amountToApply: string };

// Walks candidates (assumed already ordered soonest-expiring first) drawing
// min(balanceRemaining, amountStillNeeded) from each until `amountNeeded` is fully
// funded or the candidates are exhausted. Pure — unit-testable without a DB
// connection; resolveCreditFifoAllocation below is the DB-fetching wrapper.
export function allocateCreditFifo(
	candidates: { id: string; balanceRemaining: string }[],
	amountNeeded: string
): CreditFifoAllocation[] {
	const allocations: CreditFifoAllocation[] = [];
	let remaining = toBig(amountNeeded);

	for (const candidate of candidates) {
		if (remaining.lte(0)) break;
		const available = toBig(candidate.balanceRemaining);
		const draw = available.lt(remaining) ? available : remaining;
		if (draw.lte(0)) continue;
		allocations.push({ creditNoteId: candidate.id, amountToApply: toDecimalString(draw) });
		remaining = remaining.minus(draw);
	}

	return allocations;
}

// Fetches a member's redeemable credit notes soonest-expiring first and allocates
// `amountNeeded` across them via allocateCreditFifo. Read-only — Step 5's
// applyCreditRedemption persists the returned allocation.
export async function resolveCreditFifoAllocation(
	dbOrTx: DbClient,
	memberId: string,
	amountNeeded: string
): Promise<CreditFifoAllocation[]> {
	const candidates = await dbOrTx.query.creditNotes.findMany({
		where: redeemableCreditNotesWhere(memberId, dateFormat(new Date())),
		columns: { id: true, balanceRemaining: true },
		orderBy: (row, { asc }) => [asc(row.expiresAt)],
	});

	return allocateCreditFifo(candidates, amountNeeded);
}
