import { eq, sql } from "drizzle-orm";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type * as schema from "@/drizzle/schema";
import { vwWhtBalances } from "@/drizzle/schema";

type Transaction = PgTransaction<
	NodePgQueryResultHKT,
	typeof schema,
	ExtractTablesWithRelations<typeof schema>
>;

/**
 * Locks a bill's row and returns its current WHT balance (or null if the bill
 * has none), serialising concurrent remittances/corrections that touch the
 * same bill so they can't both read a balance the pair together would
 * violate.
 */
export async function lockBillWhtBalance(
	tx: Transaction,
	billId: string,
): Promise<number | null> {
	await tx.execute(sql`SELECT id FROM bills WHERE id = ${billId} FOR UPDATE`);

	const [current] = await tx
		.select({ whtBalance: vwWhtBalances.whtBalance })
		.from(vwWhtBalances)
		.where(eq(vwWhtBalances.id, billId));

	return current ? Number(current.whtBalance) : null;
}
