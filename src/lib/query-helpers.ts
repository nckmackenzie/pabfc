import { and, eq, gt, gte, lte, type SQL, sql } from "drizzle-orm";
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
 * no invoice/entry date range applies. `isOverdue` is computed by the view from
 * the bill payment lines on every read, so unlike a stored status it cannot go
 * stale.
 */
export function overdueBillFilters() {
	return eq(vwInvoices.isOverdue, true);
}

/**
 * Bills that still owe money and are actually payable. `isOverdue` is a subset
 * of this, so AP reports that bucket outstanding money (ageing) and reports
 * that list only late money (overdue) share the same population and reconcile.
 */
export function outstandingBillFilters() {
	return and(eq(vwInvoices.isPayable, true), gt(vwInvoices.balance, "0"));
}
