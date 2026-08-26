import { createServerFn } from "@tanstack/react-start";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import {
	bills,
	expenseHeaders,
	membershipPlans,
	members,
	payees,
	payments,
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
import { expenseFilters, paymentFilters } from "@/lib/query-helpers";
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
			db
				.select({
					totalExpenses: sql<number>`coalesce(sum(${expenseHeaders.totalAmount}), 0)`,
				})
				.from(expenseHeaders)
				.where(expenseFilters(currentExpenseFilters)),
			db
				.select({
					totalExpensesPreviousPeriod: sql<number>`coalesce(sum(${expenseHeaders.totalAmount}), 0)`,
				})
				.from(expenseHeaders)
				.where(expenseFilters(previousExpenseFilters)),
			db
				.select({
					totalOverdueBills: sql<number>`coalesce(sum(${bills.total}), 0)`,
				})
				.from(bills)
				.where(eq(bills.status, "overdue")),
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
			totalExpensesLast30Days: totalExpenses[0].totalExpenses,
			totalExpensesPreviousPeriod: totalExpensesPreviousPeriod[0].totalExpensesPreviousPeriod,
			totalOverdueBills: totalOverdueBills[0].totalOverdueBills,
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
			db
				.select({
					date: expenseHeaders.expenseDate,
					amount: sql<number>`coalesce(sum(${expenseHeaders.totalAmount}), 0)`,
				})
				.from(expenseHeaders)
				.where(expenseFilters(currentExpenseFilters))
				.groupBy(expenseHeaders.expenseDate),
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
			db
				.select({
					date: expenseHeaders.expenseDate,
					amount: expenseHeaders.totalAmount,
					reference: sql<string>`coalesce(${expenseHeaders.reference}, concat('EXP-', ${expenseHeaders.expenseNo}::text))`,
					entity: payees.name,
				})
				.from(expenseHeaders)
				.innerJoin(payees, eq(expenseHeaders.payeeId, payees.id))
				.where(expenseFilters(currentExpenseFilters))
				.orderBy(desc(expenseHeaders.expenseDate))
				.limit(10),
		]);
		const recentActivities = mergeRecentFinanceTransactions(
			incomeRows.map((row) => ({
				...row,
				type: "income" as const,
				amount: Number(row.amount),
			})),
			expenseRows.map((row) => ({
				...row,
				type: "expense" as const,
				amount: Number(row.amount),
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
			fill: `var(--chart-${index + 1})`,
		}));
	});
