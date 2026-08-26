import { format, parseISO } from "date-fns";
import { getFinanceStatDates } from "./helpers";

export type FinanceChartRow = {
	date: string;
	amount: number | string;
};

export type RecentFinanceTransaction = {
	date: Date | string;
	type: "income" | "expense";
	amount: number;
	reference: string;
	entity: string;
	status: string;
};

export function getCurrentFinancePaymentFilterParams(today = new Date()) {
	const { currentPeriodStart, currentPeriodEnd } = getFinanceStatDates(today);

	return {
		dateFrom: currentPeriodStart,
		dateTo: currentPeriodEnd,
		status: "completed" as const,
	};
}

function formatFinanceCalendarDate(date: Date) {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: "Africa/Nairobi",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	})
		.formatToParts(date)
		.filter(({ type }) => type !== "literal")
		.reduce<Record<string, string>>((result, { type, value }) => {
			result[type] = value;
			return result;
		}, {});

	return `${parts.year}-${parts.month}-${parts.day}`;
}

export function getFinanceExpenseFilterParams(dateFrom: Date, dateTo: Date) {
	return {
		dateFrom: formatFinanceCalendarDate(dateFrom),
		dateTo: formatFinanceCalendarDate(dateTo),
	};
}

export function getCurrentFinanceExpenseFilterParams(today = new Date()) {
	const { currentPeriodStart, currentPeriodEnd } = getFinanceStatDates(today);
	return getFinanceExpenseFilterParams(currentPeriodStart, currentPeriodEnd);
}

export function shouldUseFinanceMockData(
	isProduction: boolean,
	paymentCount: number,
	expenseCount: number
) {
	return !isProduction && paymentCount === 0 && expenseCount === 0;
}

export function buildFinanceChartData(
	revenueRows: FinanceChartRow[],
	expenseRows: FinanceChartRow[]
) {
	const rowsByDate = new Map<string, { date: string; revenue: number; expenses: number }>();

	for (const { amount, date } of revenueRows) {
		rowsByDate.set(date, {
			date,
			revenue: Number(amount),
			expenses: rowsByDate.get(date)?.expenses ?? 0,
		});
	}

	for (const { amount, date } of expenseRows) {
		const existing = rowsByDate.get(date);
		rowsByDate.set(date, {
			date,
			revenue: existing?.revenue ?? 0,
			expenses: Number(amount),
		});
	}

	return [...rowsByDate.values()]
		.sort((a, b) => a.date.localeCompare(b.date))
		.map((row) => ({ ...row, date: format(parseISO(row.date), "MMM dd") }));
}

export function mergeRecentFinanceTransactions(
	income: RecentFinanceTransaction[],
	expenses: RecentFinanceTransaction[]
) {
	return [...income, ...expenses]
		.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
		.slice(0, 10);
}

export function buildFinanceMockData(today = new Date()) {
	const currentDateParts = new Intl.DateTimeFormat("en-CA", {
		timeZone: "Africa/Nairobi",
		year: "numeric",
		month: "numeric",
		day: "numeric",
	})
		.formatToParts(today)
		.filter(({ type }) => type !== "literal")
		.reduce<Record<string, number>>((parts, { type, value }) => {
			parts[type] = Number(value);
			return parts;
		}, {});
	const currentMonth = currentDateParts.month;
	const currentYear = currentDateParts.year;
	const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1;
	const previousYear = currentMonth === 1 ? currentYear - 1 : currentYear;
	const previousMonthLastDay = new Date(Date.UTC(previousYear, previousMonth, 0)).getUTCDate();
	const currentDays = Array.from({ length: currentDateParts.day }, (_, index) => index + 1);
	const previousDays = Array.from(
		{ length: Math.min(currentDateParts.day, previousMonthLastDay) },
		(_, index) => index + 1
	);
	const revenueForDay = (day: number) => 1_000 + ((day * 137) % 900);
	const expensesForDay = (day: number) => 200 + ((day * 83) % 500);
	const revenueExpensesChartData = currentDays.map((day) => ({
		date: format(new Date(currentYear, currentMonth - 1, day), "MMM dd"),
		revenue: revenueForDay(day),
		expenses: expensesForDay(day),
	}));
	const totalRevenueLast30Days = revenueExpensesChartData.reduce(
		(total, row) => total + row.revenue,
		0
	);
	const totalExpensesLast30Days = revenueExpensesChartData.reduce(
		(total, row) => total + row.expenses,
		0
	);
	const totalRevenuePreviousPeriod = previousDays.reduce(
		(total, day) => total + revenueForDay(day),
		0
	);
	const totalExpensesPreviousPeriod = previousDays.reduce(
		(total, day) => total + expensesForDay(day),
		0
	);
	const basicRevenue = Math.floor(totalRevenueLast30Days * 0.45);
	const proRevenue = Math.floor(totalRevenueLast30Days * 0.3);
	const eliteRevenue = Math.floor(totalRevenueLast30Days * 0.15);
	const planDistribution = [
		{ name: "Basic", value: basicRevenue, fill: "var(--chart-1)" },
		{ name: "Pro", value: proRevenue, fill: "var(--chart-2)" },
		{ name: "Elite", value: eliteRevenue, fill: "var(--chart-3)" },
		{
			name: "Student",
			value: totalRevenueLast30Days - basicRevenue - proRevenue - eliteRevenue,
			fill: "var(--chart-4)",
		},
	];
	const recentActivities: RecentFinanceTransaction[] = currentDays
		.flatMap((day) => [
			{
				date: `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
				type: "income" as const,
				amount: revenueForDay(day),
				reference: `PAY-${currentYear}${String(currentMonth).padStart(2, "0")}${String(day).padStart(2, "0")}`,
				entity: "Sample Member",
				status: "completed",
			},
			{
				date: `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
				type: "expense" as const,
				amount: expensesForDay(day),
				reference: `EXP-${currentYear}${String(currentMonth).padStart(2, "0")}${String(day).padStart(2, "0")}`,
				entity: "Sample Payee",
				status: "completed",
			},
		])
		.reverse()
		.slice(0, 10);

	return {
		totalRevenueLast30Days,
		totalRevenuePreviousPeriod,
		totalExpensesLast30Days,
		totalExpensesPreviousPeriod,
		totalOverdueBills: 0,
		totalDiscountedRevenue: Math.floor(totalRevenueLast30Days * 0.1),
		totalDiscountedRevenuePreviousPeriod: Math.floor(totalRevenuePreviousPeriod * 0.1),
		revenueExpensesChartData,
		planDistribution,
		recentActivities,
	};
}
