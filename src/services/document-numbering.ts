import { sql } from "drizzle-orm";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type * as schema from "@/drizzle/schema";

type Transaction = PgTransaction<
	NodePgQueryResultHKT,
	typeof schema,
	ExtractTablesWithRelations<typeof schema>
>;

type NumberedDocument = {
	table: "wht_corrections" | "wht_remittances";
	column: "correction_no" | "remittance_no";
};

/**
 * Returns the next sequential number for a numbered document, serialised
 * against concurrent callers for the same document type via a
 * transaction-scoped Postgres advisory lock (released automatically at
 * commit/rollback) so two transactions can never read the same MAX and both
 * win. Must be called inside the same transaction that inserts the row using
 * the returned number, before that insert runs.
 */
export async function getNextDocumentNumber(
	tx: Transaction,
	{ table, column }: NumberedDocument,
): Promise<number> {
	await tx.execute(
		sql`SELECT pg_advisory_xact_lock(hashtext(${`${table}.${column}`}))`,
	);

	const result = await tx.execute<{ nextNo: number }>(
		sql`SELECT COALESCE(MAX(${sql.raw(column)}), 0) + 1 AS "nextNo" FROM ${sql.raw(table)}`,
	);

	return result.rows[0]?.nextNo ?? 1;
}
