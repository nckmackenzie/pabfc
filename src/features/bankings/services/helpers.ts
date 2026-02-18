import { and, eq, gte, lte, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { db } from "@/drizzle/db";
import {
	bankAccounts,
	bankPostings,
	journalEntries,
	journalLines,
} from "@/drizzle/schema";

const signedAmount = (dcCol: PgColumn, amountCol: PgColumn) =>
	sql`CASE WHEN ${dcCol} = 'debit' THEN ${amountCol} ELSE -${amountCol} END`;

const sumSigned = (dcCol: PgColumn, amountCol: PgColumn) =>
	sql<string>`COALESCE(SUM(${signedAmount(dcCol, amountCol)}), 0)::numeric`;

export async function getCashbookBalance(bankId: string, endDate: string) {
	const [bank] = await db
		.select({ ledgerAccountId: bankAccounts.accountId })
		.from(bankAccounts)
		.where(eq(bankAccounts.id, bankId))
		.limit(1);

	if (!bank?.ledgerAccountId) return 0;

	const [row] = await db
		.select({ balance: sumSigned(journalLines.dc, journalLines.amount) })
		.from(journalLines)
		.innerJoin(
			journalEntries,
			eq(journalEntries.id, journalLines.journalEntryId),
		)
		.where(
			and(
				eq(journalLines.accountId, bank.ledgerAccountId),
				lte(journalEntries.entryDate, endDate),
			),
		);

	return row?.balance ? Number(row.balance) : 0;
}

export async function getUnclearedAmounts(
	bankId: string,
	startDate: string,
	endDate: string,
	dc: "debit" | "credit",
) {
	const [row] = await db
		.select({
			amount: sql<string>`COALESCE(SUM(${bankPostings.amount}), 0)::numeric`,
		})
		.from(bankPostings)
		.where(
			and(
				eq(bankPostings.bankId, bankId),
				eq(bankPostings.cleared, false),
				eq(bankPostings.dc, dc),
				gte(bankPostings.transactionDate, startDate),
				lte(bankPostings.transactionDate, endDate),
			),
		);

	return row?.amount ? Number(row.amount) : 0;
}
