/** biome-ignore-all lint/suspicious/noExplicitAny: <> */
import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { expenseHeaders, membershipPlans, payments } from "@/drizzle/schema";
import { getStatDates } from "@/features/dashboard/lib/date-helpers";
import { dateFormat } from "@/lib/helpers";
import { requirePermission } from "@/lib/permissions/permissions";
import { toTitleCase } from "@/lib/utils";
import { authMiddleware } from "@/middlewares/auth-middleware";

const { startOfLast30Days, startOfPreviousPeriod, endOfPreviousPeriod } =
	getStatDates();

export const getFinanceStats = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		await requirePermission("dashboard:finance");

		const [
			totalRevenue,
			totalRevenuePreviousPeriod,
			totalExpenses,
			totalExpensesPreviousPeriod,
			topPlan,
			totalDiscountedRevenue,
			totalDiscountedRevenuePreviousPeriod,
		] = await Promise.all([
			db
				.select({
					totalRevenue: sql<number>`coalesce(sum(${payments.amount}), 0)`,
				})
				.from(payments)
				.where(
					and(
						gte(payments.paymentDate, startOfLast30Days),
						lte(payments.paymentDate, new Date()),
						eq(payments.status, "completed"),
					),
				),
			db
				.select({
					totalRevenuePreviousPeriod: sql<number>`coalesce(sum(${payments.amount}), 0)`,
				})
				.from(payments)
				.where(
					and(
						gte(payments.paymentDate, startOfPreviousPeriod),
						lte(payments.paymentDate, endOfPreviousPeriod),
						eq(payments.status, "completed"),
					),
				),
			db
				.select({
					totalExpenses: sql<number>`coalesce(sum(${expenseHeaders.subTotal}), 0)`,
				})
				.from(expenseHeaders)
				.where(
					and(
						gte(expenseHeaders.expenseDate, dateFormat(startOfLast30Days)),
						lte(expenseHeaders.expenseDate, dateFormat(new Date())),
					),
				),
			db
				.select({
					totalExpensesPreviousPeriod: sql<number>`coalesce(sum(${expenseHeaders.subTotal}), 0)`,
				})
				.from(expenseHeaders)
				.where(
					and(
						gte(expenseHeaders.expenseDate, dateFormat(startOfPreviousPeriod)),
						lte(expenseHeaders.expenseDate, dateFormat(endOfPreviousPeriod)),
					),
				),
			db
				.select({
					planName: membershipPlans.name,
					amount: sql<number>`coalesce(sum(${payments.amount}), 0)`.as(
						"total_amount",
					),
				})
				.from(payments)
				.innerJoin(membershipPlans, eq(payments.planId, membershipPlans.id))
				.where(
					and(
						gte(payments.paymentDate, startOfLast30Days),
						lte(payments.paymentDate, new Date()),
						eq(payments.status, "completed"),
					),
				)
				.groupBy(membershipPlans.name, payments.planId)
				.orderBy(desc(sql`total_amount`))
				.limit(1),
			db
				.select({
					totalDiscountedRevenue: sql<number>`coalesce(sum(${payments.discountedAmount}), 0)`,
				})
				.from(payments)
				.where(
					and(
						gte(payments.paymentDate, startOfLast30Days),
						lte(payments.paymentDate, new Date()),
						eq(payments.status, "completed"),
					),
				),
			db
				.select({
					totalDiscountedRevenuePreviousPeriod: sql<number>`coalesce(sum(${payments.discountedAmount}), 0)`,
				})
				.from(payments)
				.where(
					and(
						gte(payments.paymentDate, startOfPreviousPeriod),
						lte(payments.paymentDate, endOfPreviousPeriod),
						eq(payments.status, "completed"),
					),
				),
		]);

		const stats = {
			totalRevenueLast30Days: totalRevenue[0].totalRevenue,
			totalRevenuePreviousPeriod:
				totalRevenuePreviousPeriod[0].totalRevenuePreviousPeriod,
			totalExpensesLast30Days: totalExpenses[0].totalExpenses,
			totalExpensesPreviousPeriod:
				totalExpensesPreviousPeriod[0].totalExpensesPreviousPeriod,
			topPlan: topPlan.length > 0 ? topPlan[0] : null,
			totalDiscountedRevenue: totalDiscountedRevenue[0].totalDiscountedRevenue,
			totalDiscountedRevenuePreviousPeriod:
				totalDiscountedRevenuePreviousPeriod[0]
					.totalDiscountedRevenuePreviousPeriod,
			// TODO: Add real chart data queries here when available
			revenueExpensesChartData: [], // Placeholder for real implementation
			planDistribution: [], // Placeholder for real implementation
			recentActivities: [], // Placeholder for real implementation
		};

		const isProduction = process.env.APP_ENV === "production";
		const hasNoData =
			+stats.totalRevenueLast30Days === 0 &&
			+stats.totalExpensesLast30Days === 0;

		if (!isProduction && hasNoData) {
			const { getMockFinanceData } = await import(
				"@/features/dashboard/lib/finance-mock-data"
			);
			return getMockFinanceData();
		}

		return stats;
	});

export const getFinanceChartData = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		await requirePermission("dashboard:finance");

		// TODO: GET ACTUAL DATA
		const chartData: any[] = [];

		const isProduction = process.env.APP_ENV === "production";
		if (!isProduction && chartData.length === 0) {
			const { getMockFinanceData } = await import(
				"@/features/dashboard/lib/finance-mock-data"
			);
			return getMockFinanceData().revenueExpensesChartData;
		}

		return chartData;
	});

export const getRecentTransactions = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		await requirePermission("dashboard:finance");

		// TODO: GET ACTUAL DATA Placeholder for real query
		const recentActivities: any[] = [];

		const isProduction = process.env.APP_ENV === "production";
		if (!isProduction && recentActivities.length === 0) {
			const { getMockFinanceData } = await import(
				"@/features/dashboard/lib/finance-mock-data"
			);
			return getMockFinanceData().recentActivities.slice(0, 10);
		}

		return recentActivities;
	});

export const getPlanDistribution = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		await requirePermission("dashboard:finance");

		const planDistribution = await db
			.select({
				planName: membershipPlans.name,
				amount: sql<number>`coalesce(sum(${payments.amount}), 0)`.as(
					"total_amount",
				),
			})
			.from(payments)
			.innerJoin(membershipPlans, eq(payments.planId, membershipPlans.id))
			.where(
				and(
					gte(payments.paymentDate, startOfLast30Days),
					lte(payments.paymentDate, new Date()),
					eq(payments.status, "completed"),
				),
			)
			.groupBy(membershipPlans.name, payments.planId)
			.orderBy(desc(sql`total_amount`));

		const isProduction = process.env.APP_ENV === "production";
		if (!isProduction && planDistribution.length === 0) {
			const { getMockFinanceData } = await import(
				"@/features/dashboard/lib/finance-mock-data"
			);
			return getMockFinanceData().planDistribution;
		}

		return planDistribution.map(({ amount, planName }, index) => ({
			name: toTitleCase(planName.toLowerCase()),
			value: Number(amount),
			fill: `var(--chart-${index + 1})`,
		}));
	});
