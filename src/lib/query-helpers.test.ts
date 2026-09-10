import { QueryBuilder } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import {
	journalEntries,
	journalLines,
	ledgerAccounts,
	vwInvoices,
} from "@/drizzle/schema";
import {
	expenseJournalFilters,
	journalLineNetTotal,
	overdueBillFilters,
} from "@/lib/query-helpers";

const qb = new QueryBuilder();

function expenseJournalQuery(range: {
	dateFrom: Date | string;
	dateTo: Date | string;
}) {
	return qb
		.select({ total: journalLineNetTotal })
		.from(journalLines)
		.innerJoin(
			journalEntries,
			eq(journalEntries.id, journalLines.journalEntryId),
		)
		.innerJoin(ledgerAccounts, eq(ledgerAccounts.id, journalLines.accountId))
		.where(expenseJournalFilters(range))
		.toSQL();
}

import { eq } from "drizzle-orm";

describe("expenseJournalFilters", () => {
	it("restricts to expense-type ledger accounts", () => {
		const { sql, params } = expenseJournalQuery({
			dateFrom: "2026-06-01",
			dateTo: "2026-06-30",
		});

		expect(sql).toContain('"ledger_accounts"."type" = $1');
		expect(params[0]).toBe("expense");
	});

	it("bounds the journal entry date to the requested range", () => {
		const { sql, params } = expenseJournalQuery({
			dateFrom: "2026-06-01",
			dateTo: "2026-06-30",
		});

		expect(sql).toContain('"journal_entries"."entry_date" >= $2');
		expect(sql).toContain('"journal_entries"."entry_date" <= $3');
		expect(params.slice(1)).toEqual(["2026-06-01", "2026-06-30"]);
	});

	it("normalizes Date inputs to calendar dates", () => {
		const { params } = expenseJournalQuery({
			dateFrom: new Date(2026, 5, 1, 13, 45),
			dateTo: new Date(2026, 5, 30, 13, 45),
		});

		expect(params.slice(1)).toEqual(["2026-06-01", "2026-06-30"]);
	});

	it("nets credits against debits rather than summing debits only", () => {
		const { sql } = expenseJournalQuery({
			dateFrom: "2026-06-01",
			dateTo: "2026-06-30",
		});

		expect(sql).toContain(
			`case when "journal_lines"."dc" = 'debit' then "journal_lines"."amount" else -"journal_lines"."amount" end`,
		);
	});
});

describe("overdueBillFilters", () => {
	const overdueQuery = () =>
		qb
			.select({ balance: vwInvoices.balance })
			.from(vwInvoices)
			.where(overdueBillFilters())
			.toSQL();

	it("keeps only bills past their due date", () => {
		const { sql } = overdueQuery();

		expect(sql).toContain('"vw_invoices"."due_date" is not null');
		expect(sql).toContain('"vw_invoices"."due_date" < current_date');
	});

	it("keeps only bills that still carry a balance", () => {
		const { sql, params } = overdueQuery();

		expect(sql).toContain('"vw_invoices"."balance" > $1');
		expect(params).toEqual(["0"]);
	});

	it("does not depend on the stored bill status", () => {
		const { sql } = overdueQuery();

		expect(sql).not.toContain("status");
	});

	it("applies no invoice or entry date range", () => {
		const { sql } = overdueQuery();

		expect(sql).not.toContain("invoice_date");
	});
});
