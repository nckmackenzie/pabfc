import { createServerFn } from "@tanstack/react-start";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import {
	bills,
	expenseHeaders,
	journalEntries,
	journalLines,
	ledgerAccounts,
	membershipPlans,
	members,
	payees,
	payments,
	vendors,
	vwInvoices,
} from "@/drizzle/schema";
import {
	buildFinanceChartData,
	getCurrentFinanceExpenseFilterParams,
	getCurrentFinancePaymentFilterParams,
	getFinanceExpenseFilterParams,
	mergeRecentFinanceTransactions,
	shouldUseFinanceMockData,
} from "@/features/dashboard/lib/finance-data";
import { getFinanceStatDates } from "@/features/dashboard/lib/helpers";
import { requirePermission } from "@/lib/permissions/permissions";
import {
	expenseFilters,
	expenseJournalFilters,
	journalLineNetAmount,
	journalLineNetTotal,
	overdueBillFilters,
	paymentFilters,
} from "@/lib/query-helpers";
import { toTitleCase } from "@/lib/utils";
import { authMiddleware } from "@/middlewares/auth-middleware";

async function getFinanceMockDataIfNeeded(
	currentPaymentFilters: ReturnType<typeof getCurrentFinancePaymentFilterParams>,
	currentExpenseFilters: ReturnType<typeof getCurrentFinanceExpenseFilterParams>
) {
	const isProduction = process.env.APP_ENV === "production";
	if (isProduction) return null;

	const [[paymentData], [expenseData]] = await Promise.all([
		db
			.select({ count: sql<number>`count(*)` })
			.from(payments)
			.where(paymentFilters(currentPaymentFilters)),
		db
			.select({ count: sql<number>`count(*)` })
			.from(expenseHeaders)
			.where(expenseFilters(currentExpenseFilters)),
	]);

	if (
		!shouldUseFinanceMockData(isProduction, Number(paymentData.count), Number(expenseData.count))
	) {
		return null;
	}

	const { getMockFinanceData } = await import("@/features/dashboard/lib/finance-mock-data");
	return getMockFinanceData();
}

type ExpenseJournalDateRange = ReturnType<typeof getFinanceExpenseFilterParams>;

// Every expense figure on this dashboard - the stat card, the chart series, the
// recent transactions list and the drill-down sheet - is read through the three
// functions below, which all apply `expenseJournalFilters` over the same join
// chain. Expenses, bills and payroll all post to expense-type accounts, so
// journal lines capture every source exactly once, on an accrual basis, and
// reversals net themselves out.

/** Net expense recognised on the ledger for a period. */
async function getExpenseJournalTotal(range: ExpenseJournalDateRange) {
	const [row] = await db
		.select({ total: journalLineNetTotal })
		.from(journalLines)
		.innerJoin(journalEntries, eq(journalEntries.id, journalLines.journalEntryId))
		.innerJoin(ledgerAccounts, eq(ledgerAccounts.id, journalLines.accountId))
		.where(expenseJournalFilters(range));

	return Number(row.total);
}

/** Net expense per calendar day, for the revenue/expenses chart series. */
async function getExpenseJournalDailyTotals(range: ExpenseJournalDateRange) {
	return db
		.select({
			date: journalEntries.entryDate,
			amount: journalLineNetTotal,
		})
		.from(journalLines)
		.innerJoin(journalEntries, eq(journalEntries.id, journalLines.journalEntryId))
		.innerJoin(ledgerAccounts, eq(ledgerAccounts.id, journalLines.accountId))
		.where(expenseJournalFilters(range))
		.groupBy(journalEntries.entryDate);
}

/**
 * Individual expense postings for a period, newest first. `limit` is for the
 * recent-transactions list; omit it for the full drill-down.
 */
async function getExpenseJournalLines(range: ExpenseJournalDateRange, limit?: number) {
	const query = db
		.select({
			id: journalLines.id,
			date: journalEntries.entryDate,
			account: ledgerAccounts.name,
			source: journalEntries.source,
			entity: sql<string | null>`coalesce(${payees.name}, ${vendors.name})`,
			reference: sql<
				string | null
			>`coalesce(${journalEntries.reference}, ${bills.invoiceNo}, ${expenseHeaders.reference}, ${journalLines.memo}, ${journalEntries.description})`,
			amount: journalLineNetAmount,
		})
		.from(journalLines)
		.innerJoin(journalEntries, eq(journalEntries.id, journalLines.journalEntryId))
		.innerJoin(ledgerAccounts, eq(ledgerAccounts.id, journalLines.accountId))
		.leftJoin(
			expenseHeaders,
			and(eq(journalEntries.source, "expenses"), eq(expenseHeaders.id, journalEntries.sourceId))
		)
		.leftJoin(payees, eq(payees.id, expenseHeaders.payeeId))
		.leftJoin(bills, and(eq(journalEntries.source, "bills"), eq(bills.id, journalEntries.sourceId)))
		.leftJoin(vendors, eq(vendors.id, bills.vendorId))
		.where(expenseJournalFilters(range))
		.orderBy(desc(journalEntries.entryDate), asc(journalLines.lineNumber))
		.$dynamic();

	const rows = await (limit ? query.limit(limit) : query);

	return rows.map((row) => ({ ...row, amount: Number(row.amount) }));
}

/** Outstanding balance across every bill that is past due, point in time. */
async function getOverdueBillsTotal() {
	const [row] = await db
		.select({
			total: sql<string>`coalesce(sum(${vwInvoices.balance}), 0)`,
		})
		.from(vwInvoices)
		.where(overdueBillFilters());

	return Number(row.total);
}

export const getFinanceStats = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		await requirePermission("dashboard:finance");
		const now = new Date();
		const { previousPeriodStart, previousPeriodEnd } = getFinanceStatDates(now);
		const currentPaymentFilters = getCurrentFinancePaymentFilterParams(now);
		const currentExpenseFilters = getCurrentFinanceExpenseFilterParams(now);
		const previousExpenseFilters = getFinanceExpenseFilterParams(
			previousPeriodStart,
			previousPeriodEnd
		);
		const mockData = await getFinanceMockDataIfNeeded(currentPaymentFilters, currentExpenseFilters);
		if (mockData) return mockData;

		const [
			totalRevenue,
			totalRevenuePreviousPeriod,
			totalExpenses,
			totalExpensesPreviousPeriod,
			totalOverdueBills,
			totalDiscountedRevenue,
			totalDiscountedRevenuePreviousPeriod,
		] = await Promise.all([
			db
				.select({
					totalRevenue: sql<number>`coalesce(sum(${payments.amount}), 0)`,
				})
				.from(payments)
				.where(paymentFilters(currentPaymentFilters)),
			db
				.select({
					totalRevenuePreviousPeriod: sql<number>`coalesce(sum(${payments.amount}), 0)`,
				})
				.from(payments)
				.where(
					paymentFilters({
						dateFrom: previousPeriodStart,
						dateTo: previousPeriodEnd,
						status: "completed",
					})
				),
			getExpenseJournalTotal(currentExpenseFilters),
			getExpenseJournalTotal(previousExpenseFilters),
			getOverdueBillsTotal(),
			db
				.select({
					totalDiscountedRevenue: sql<number>`coalesce(sum(${payments.discountedAmount}), 0)`,
				})
				.from(payments)
				.where(paymentFilters(currentPaymentFilters)),
			db
				.select({
					totalDiscountedRevenuePreviousPeriod: sql<number>`coalesce(sum(${payments.discountedAmount}), 0)`,
				})
				.from(payments)
				.where(
					paymentFilters({
						dateFrom: previousPeriodStart,
						dateTo: previousPeriodEnd,
						status: "completed",
					})
				),
		]);

		// These response keys are still consumed by the existing dashboard UI,
		// but the values now represent MTD and previous-month-to-date ranges.
		const stats = {
			totalRevenueLast30Days: totalRevenue[0].totalRevenue,
			totalRevenuePreviousPeriod: totalRevenuePreviousPeriod[0].totalRevenuePreviousPeriod,
			totalExpensesLast30Days: totalExpenses,
			totalExpensesPreviousPeriod,
			totalOverdueBills,
			totalDiscountedRevenue: totalDiscountedRevenue[0].totalDiscountedRevenue,
			totalDiscountedRevenuePreviousPeriod:
				totalDiscountedRevenuePreviousPeriod[0].totalDiscountedRevenuePreviousPeriod,
			revenueExpensesChartData: [],
			planDistribution: [],
			recentActivities: [],
		};

		return stats;
	});

export const getFinanceChartData = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		await requirePermission("dashboard:finance");
		const now = new Date();
		const currentPaymentFilters = getCurrentFinancePaymentFilterParams(now);
		const currentExpenseFilters = getCurrentFinanceExpenseFilterParams(now);
		const mockData = await getFinanceMockDataIfNeeded(currentPaymentFilters, currentExpenseFilters);
		if (mockData) return mockData.revenueExpensesChartData;
		const [revenueRows, expenseRows] = await Promise.all([
			db
				.select({
					date: sql<string>`to_char(${payments.paymentDate} at time zone 'Africa/Nairobi', 'YYYY-MM-DD')`,
					amount: sql<number>`coalesce(sum(${payments.amount}), 0)`,
				})
				.from(payments)
				.where(paymentFilters(currentPaymentFilters))
				.groupBy(sql`to_char(${payments.paymentDate} at time zone 'Africa/Nairobi', 'YYYY-MM-DD')`),
			// Same ledger basis as the Expenses stat card, so the card total and
			// the chart series always describe the same money.
			getExpenseJournalDailyTotals(currentExpenseFilters),
		]);
		const chartData = buildFinanceChartData(revenueRows, expenseRows);

		return chartData;
	});

export const getRecentTransactions = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		await requirePermission("dashboard:finance");
		const now = new Date();
		const currentPaymentFilters = getCurrentFinancePaymentFilterParams(now);
		const currentExpenseFilters = getCurrentFinanceExpenseFilterParams(now);
		const mockData = await getFinanceMockDataIfNeeded(currentPaymentFilters, currentExpenseFilters);
		if (mockData) return mockData.recentActivities;
		const [incomeRows, expenseRows] = await Promise.all([
			db
				.select({
					date: payments.paymentDate,
					amount: payments.amount,
					reference: sql<string>`coalesce(${payments.reference}, ${payments.paymentNo})`,
					entity: sql<string>`concat(${members.firstName}, ' ', ${members.lastName})`,
					status: payments.status,
				})
				.from(payments)
				.innerJoin(members, eq(payments.memberId, members.id))
				.where(paymentFilters(currentPaymentFilters))
				.orderBy(desc(payments.paymentDate))
				.limit(10),
			// Same ledger basis as the Expenses stat card and chart series.
			getExpenseJournalLines(currentExpenseFilters, 10),
		]);
		const recentActivities = mergeRecentFinanceTransactions(
			incomeRows.map((row) => ({
				...row,
				type: "income" as const,
				amount: Number(row.amount),
			})),
			expenseRows.map((row) => ({
				date: row.date,
				reference: row.reference ?? row.account,
				entity: row.entity ?? toTitleCase(row.source ?? "journal"),
				type: "expense" as const,
				amount: row.amount,
				status: "completed",
			}))
		);

		return recentActivities;
	});

export const getPlanDistribution = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		await requirePermission("dashboard:finance");
		const now = new Date();
		const currentPaymentFilters = getCurrentFinancePaymentFilterParams(now);
		const currentExpenseFilters = getCurrentFinanceExpenseFilterParams(now);
		const mockData = await getFinanceMockDataIfNeeded(currentPaymentFilters, currentExpenseFilters);
		if (mockData) return mockData.planDistribution;

		const CHART_COLOR_COUNT = 5;

		const planDistribution = await db
			.select({
				planName: sql<string>`coalesce(${membershipPlans.name}, 'Unassigned')`,
				amount: sql<number>`coalesce(sum(${payments.amount}), 0)`.as("total_amount"),
			})
			.from(payments)
			.leftJoin(membershipPlans, eq(payments.planId, membershipPlans.id))
			.where(paymentFilters(currentPaymentFilters))
			.groupBy(membershipPlans.name, payments.planId)
			.orderBy(desc(sql`total_amount`));

		return planDistribution.map(({ amount, planName }, index) => ({
			name: toTitleCase(planName.toLowerCase()),
			value: Number(amount),
			// fill: `var(--chart-${index + 1})`,
			fill: `var(--chart-${(index % CHART_COLOR_COUNT) + 1})`,
		}));
	});

/**
 * Drill-down behind the Expenses stat card. Lists the same postings that
 * `getExpenseJournalTotal` sums, so the rows always reconcile with the figure on
 * the card - including under mock data, where the mock supplies the postings
 * behind its own `totalExpensesLast30Days`.
 */
export const getExpenseMtdBreakdown = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		await requirePermission("dashboard:finance");
		const now = new Date();
		const currentPaymentFilters = getCurrentFinancePaymentFilterParams(now);
		const currentExpenseFilters = getCurrentFinanceExpenseFilterParams(now);
		const mockData = await getFinanceMockDataIfNeeded(currentPaymentFilters, currentExpenseFilters);
		if (mockData) return mockData.expenseBreakdown;

		return getExpenseJournalLines(currentExpenseFilters);
	});

/**
 * Drill-down behind the Overdue Bills stat card. Shares `overdueBillFilters`
 * with `getOverdueBillsTotal` and reports each bill's remaining balance rather
 * than its original total, so the rows reconcile with the card.
 */
export const getOverdueBillsBreakdown = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		await requirePermission("dashboard:finance");
		const now = new Date();
		const currentPaymentFilters = getCurrentFinancePaymentFilterParams(now);
		const currentExpenseFilters = getCurrentFinanceExpenseFilterParams(now);
		// Mirrors the mocked `totalOverdueBills` so the card and this sheet agree.
		const mockData = await getFinanceMockDataIfNeeded(currentPaymentFilters, currentExpenseFilters);
		if (mockData) return [];

		const rows = await db
			.select({
				id: vwInvoices.id,
				vendor: vwInvoices.name,
				invoiceNo: vwInvoices.invoiceNo,
				dueDate: vwInvoices.dueDate,
				daysOverdue: sql<number>`(current_date - ${vwInvoices.dueDate})::int`,
				total: vwInvoices.total,
				balance: vwInvoices.balance,
			})
			.from(vwInvoices)
			.where(overdueBillFilters())
			.orderBy(asc(vwInvoices.dueDate), asc(vwInvoices.name));

		return rows.map((row) => ({
			...row,
			total: Number(row.total),
			balance: Number(row.balance),
		}));
	});
