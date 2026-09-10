import { and, eq, gt, gte, isNotNull, lt, lte, type SQL, sql } from "drizzle-orm";
import {
	expenseHeaders,
	journalEntries,
	journalLines,
	ledgerAccounts,
	payments,
	vwInvoices,
} from "@/drizzle/schema";
import { dateFormat } from "@/lib/helpers";

type QuerySql = {
	conditions?: Array<SQL>;
};

type PaymentFiltersProps = QuerySql & {
	dateFrom: Date;
	dateTo: Date;
	planId?: string;
	status?: "pending" | "completed" | "failed" | "cancelled" | "refunded";
};

type DateRangeFiltersProps = {
	dateFrom: Date | string;
	dateTo: Date | string;
};

function toCalendarDate(date: Date | string) {
	return typeof date === "string" ? date : dateFormat(date);
}

export function paymentFilters({
	dateFrom,
	dateTo,
	planId,
	status,
	conditions,
}: PaymentFiltersProps) {
	const filters: Array<SQL> = [];
	if (planId) {
		filters.push(eq(payments.planId, planId));
	}
	if (status) {
		filters.push(eq(payments.status, status));
	}
	filters.push(gte(payments.paymentDate, dateFrom));
	filters.push(lte(payments.paymentDate, dateTo));

	if (conditions) {
		filters.push(...conditions);
	}
	return and(...filters);
}

export function expenseFilters({ dateFrom, dateTo }: DateRangeFiltersProps) {
	const filters: Array<SQL> = [];

	filters.push(gte(expenseHeaders.expenseDate, toCalendarDate(dateFrom)));
	filters.push(lte(expenseHeaders.expenseDate, toCalendarDate(dateTo)));
	return and(...filters);
}

/**
 * Signed movement of a journal line: debits add, credits subtract. Netting the
 * two sides cancels out reversing/void entries instead of double counting them.
 */
export const journalLineNetAmount = sql<string>`case when ${journalLines.dc} = 'debit' then ${journalLines.amount} else -${journalLines.amount} end`;

export const journalLineNetTotal = sql<string>`coalesce(sum(${journalLineNetAmount}), 0)`;

/**
 * Expense recognised on the ledger for a date range. Expenses, bills and payroll
 * all post to expense-type accounts, so journal lines capture every source once.
 * Requires the query to join `journalEntries` and `ledgerAccounts`.
 */
export function expenseJournalFilters({ dateFrom, dateTo }: DateRangeFiltersProps) {
	return and(
		eq(ledgerAccounts.type, "expense"),
		gte(journalEntries.entryDate, toCalendarDate(dateFrom)),
		lte(journalEntries.entryDate, toCalendarDate(dateTo))
	);
}

/**
 * Bills that are past due and still carry an unpaid balance. Point in time, so
 * no invoice/entry date range applies. `vwInvoices.balance` is derived from the
 * bill payment lines rather than `bills.status`, which can go stale.
 */
export function overdueBillFilters() {
	return and(
		isNotNull(vwInvoices.dueDate),
		lt(vwInvoices.dueDate, sql`current_date`),
		gt(vwInvoices.balance, "0")
	);
}
