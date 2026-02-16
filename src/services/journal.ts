import type { ExtractTablesWithRelations } from "drizzle-orm";
import { and, eq, sql } from "drizzle-orm";
import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import type { PgTransaction } from "drizzle-orm/pg-core";
import { db } from "@/drizzle/db";
import type * as schema from "@/drizzle/schema";
import {
	bankAccounts,
	journalEntries,
	journalLines,
	ledgerAccounts,
} from "@/drizzle/schema";
import { defaultNormalBalanceForType } from "@/features/coa/services/coa.api";
import type { ExpenseSchema } from "@/features/expenses/services/schemas";
import { ApplicationError } from "@/lib/error-handling/app-error";

type Transaction = PgTransaction<
	NodePgQueryResultHKT,
	typeof schema,
	ExtractTablesWithRelations<typeof schema>
>;

type CreateJournalEntryParams = {
	entry: Omit<
		typeof journalEntries.$inferInsert,
		"id" | "createdAt" | "updatedAt"
	>;
	lines: Omit<typeof journalLines.$inferInsert, "id" | "journalEntryId">[];
	tx?: Transaction;
};

export const createJournalEntry = async ({
	entry,
	lines,
	tx,
}: CreateJournalEntryParams) => {
	const connection = tx ?? db;

	const [{ id: journalId }] = await connection
		.insert(journalEntries)
		.values(entry)
		.returning({ id: journalEntries.id });

	if (lines.length > 0) {
		await connection.insert(journalLines).values(
			lines.map((line) => ({
				...line,
				journalEntryId: journalId,
			})),
		);
	}

	return journalId;
};

type DeleteJournalEntryParams = {
	id?: number;
	source?: string;
	sourceId?: string;
	tx?: Transaction;
};

export const deleteJournalEntry = async ({
	id,
	source,
	sourceId,
	tx,
}: DeleteJournalEntryParams) => {
	const connection = tx ?? db;

	const filters = [];
	if (id) filters.push(eq(journalEntries.id, id));
	if (source) filters.push(eq(journalEntries.source, source));
	if (sourceId) filters.push(eq(journalEntries.sourceId, sourceId));

	if (filters.length === 0) {
		throw new Error("No criteria provided for deleting journal entry");
	}

	await connection
		.delete(journalEntries)
		.where(and(...filters))
		.returning({ id: journalEntries.id });
};

export const createOrGetAccountId = async (
	accountName: string,
	type: schema.AccountType,
	tx?: Transaction,
) => {
	const connection = tx ?? db;
	const account = await connection.query.ledgerAccounts.findFirst({
		where: eq(sql`lower(${ledgerAccounts.name})`, accountName.toLowerCase()),
	});

	if (!account) {
		const [newAccount] = await connection
			.insert(ledgerAccounts)
			.values({
				name: accountName,
				type,
				normalBalance: defaultNormalBalanceForType(type),
				isPosting: true,
				isActive: true,
			})
			.returning();
		return newAccount.id;
	}

	return account.id;
};

export const getVatAccountId = async () => {
	const billing = await db.query.settings.findFirst({
		columns: { billing: true },
	});

	if (!billing?.billing?.vatAccountId) {
		throw new Error("VAT Account not found. Define one in settings.");
	}

	return billing?.billing.vatAccountId;
};

export const areJournalValuesBalanced = (
	lines: Omit<typeof journalLines.$inferInsert, "id" | "journalEntryId">[],
) => {
	let debitTotal = 0;
	let creditTotal = 0;

	for (const line of lines) {
		const amount = parseFloat(line.amount ?? "0");
		if (line.dc === "debit") {
			debitTotal += amount;
		} else if (line.dc === "credit") {
			creditTotal += amount;
		}
	}

	return debitTotal === creditTotal;
};

type CashEquivalentAccountIdParams = {
	paymentMethod: ExpenseSchema["paymentMethod"];
	bankId?: string | null;
	creditingAccountId?: string | null;
};

export const getCashEquivalentAccountId = async ({
	paymentMethod,
	bankId,
	creditingAccountId: cashEquivalentAccountId,
}: CashEquivalentAccountIdParams) => {
	let creditingAccountId: number;

	if (paymentMethod === "bank" || paymentMethod === "cheque") {
		if (!bankId) {
			throw new ApplicationError("Bank is required for this payment method");
		}
		const result = await db
			.select({ accountId: bankAccounts.accountId })
			.from(bankAccounts)
			.where(eq(bankAccounts.id, bankId));

		if (result.length === 0) {
			throw new ApplicationError(`Bank account with ID ${bankId} not found`);
		}

		const [{ accountId }] = result;
		creditingAccountId = accountId;
	} else {
		if (!cashEquivalentAccountId) {
			throw new ApplicationError(
				"Cash equivalent account is required for this payment method",
			);
		}
		creditingAccountId = Number(cashEquivalentAccountId);
	}

	return creditingAccountId;
};
