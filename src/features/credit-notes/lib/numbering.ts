import { sql } from "drizzle-orm";
import type { Transaction } from "@/features/receipts/services/membership-payment-finalizer";

// Mirrors nextAddonInvoiceNo's advisory-lock-then-MAX+1 idiom — the lock serializes
// concurrent issuances so two transactions can't both read the same MAX and generate
// the same number (a plain in-transaction MAX+1 alone does not serialize the read).
export async function nextCreditNoteNo(tx: Transaction) {
	await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('credit_note_no'))`);
	const { rows } = await tx.execute<{ maxno: number }>(
		sql`SELECT coalesce(MAX(CAST(credit_note_no AS integer)), 0) as maxno FROM credit_notes`
	);
	return +rows[0].maxno + 1;
}
