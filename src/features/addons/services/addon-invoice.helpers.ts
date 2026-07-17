import { sql } from "drizzle-orm";
import type { Transaction } from "@/features/receipts/services/membership-payment-finalizer";

/**
 * Next addon invoice number, following the same plain-integer sequence pattern as
 * `paymentNo`. Runs on the supplied transaction so the read participates in the
 * surrounding write.
 *
 * A transaction-scoped advisory lock serializes concurrent invoice-number
 * generation, so two payments committing at the same time can't both read the same
 * MAX and then collide on the `invoice_no` unique constraint.
 */
export async function nextAddonInvoiceNo(tx: Transaction): Promise<string> {
	await tx.execute(
		sql`SELECT pg_advisory_xact_lock(hashtext('addon_invoice_no'))`,
	);
	const { rows } = await tx.execute<{ maxno: number }>(
		sql`SELECT coalesce(MAX(CAST(invoice_no AS integer)), 0) as maxno FROM addon_invoices`,
	);
	return (Number(rows[0].maxno) + 1).toString();
}
