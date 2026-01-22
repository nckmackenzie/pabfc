import { format, subDays } from "date-fns";

export interface RecentActivity {
	date: string;
	type: "income" | "expense";
	amount: number;
	reference: string;
	entity: string; // Member or Vendor
	status: string;
}

export interface FinanceStats {
	totalRevenueLast30Days: number;
	totalRevenuePreviousPeriod: number;
	totalExpensesLast30Days: number;
	totalExpensesPreviousPeriod: number;
	topPlan: { planName: string; amount: number } | null;
	totalDiscountedRevenue: number;
	totalDiscountedRevenuePreviousPeriod: number;
	revenueExpensesChartData: {
		date: string;
		revenue: number;
		expenses: number;
	}[];
	planDistribution: {
		name: string;
		value: number;
		fill: string;
	}[];
	recentActivities: RecentActivity[];
}

export const getMockFinanceData = (): FinanceStats => {
	const today = new Date();
	const recentActivities: RecentActivity[] = [];
	const revenueExpensesChartData = [];

	const members = ["John Doe", "Jane Smith", "Alice Johnson", "Bob Brown"];
	const vendors = ["Office Supplies Co.", "Cleaning Services", "Utility Corp"];
	const statuses = ["completed", "pending"];

	for (let i = 0; i < 30; i++) {
		const date = subDays(today, 29 - i);
		const dateStr = format(date, "yyyy-MM-dd");
		const chartDateStr = format(date, "MMM dd");

		// Generate random transactions for the day
		let dailyRevenue = 0;
		let dailyExpenses = 0;

		// Income transactions (1-3)
		const incomeCount = Math.floor(Math.random() * 3) + 1;
		for (let j = 0; j < incomeCount; j++) {
			const amount = Math.floor(Math.random() * 2000) + 100;
			dailyRevenue += amount;
			recentActivities.push({
				date: dateStr,
				type: "income",
				amount,
				reference: `INV-${format(date, "yyyyMMdd")}-${i}-${j}`,
				entity: members[Math.floor(Math.random() * members.length)],
				status: "completed",
			});
		}

		// Expense transactions (0-2)
		const expenseCount = Math.floor(Math.random() * 3);
		for (let j = 0; j < expenseCount; j++) {
			const amount = Math.floor(Math.random() * 1000) + 50;
			dailyExpenses += amount;
			recentActivities.push({
				date: dateStr,
				type: "expense",
				amount,
				reference: `EXP-${format(date, "yyyyMMdd")}-${i}-${j}`,
				entity: vendors[Math.floor(Math.random() * vendors.length)],
				status: statuses[Math.floor(Math.random() * statuses.length)],
			});
		}

		revenueExpensesChartData.push({
			date: chartDateStr,
			revenue: dailyRevenue,
			expenses: dailyExpenses,
		});
	}

	const totalRevenueLast30Days = revenueExpensesChartData.reduce(
		(acc, curr) => acc + curr.revenue,
		0,
	);
	const totalExpensesLast30Days = revenueExpensesChartData.reduce(
		(acc, curr) => acc + curr.expenses,
		0,
	);

	// Mock previous period data (roughly 80-90% of current or random)
	const totalRevenuePreviousPeriod = Math.floor(totalRevenueLast30Days * 0.85);
	const totalExpensesPreviousPeriod = Math.floor(totalExpensesLast30Days * 0.9);
	const totalDiscountedRevenue = Math.floor(totalRevenueLast30Days * 0.1);
	const totalDiscountedRevenuePreviousPeriod = Math.floor(
		totalRevenuePreviousPeriod * 0.12,
	);

	const planDistribution = [
		{ name: "Basic", value: 45, fill: "var(--chart-1)" },
		{ name: "Pro", value: 30, fill: "var(--chart-2)" },
		{ name: "Elite", value: 15, fill: "var(--chart-3)" },
		{ name: "Student", value: 10, fill: "var(--chart-4)" },
	];

	// Find top plan based on distribution (mock logic)
	// Just picking "Basic" as top plan for mock
	const topPlan = {
		planName: "Basic",
		amount: Math.floor(totalRevenueLast30Days * 0.45),
	};

	// Sort recent activities by date desc
	recentActivities.sort(
		(a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
	);

	return {
		totalRevenueLast30Days,
		totalRevenuePreviousPeriod,
		totalExpensesLast30Days,
		totalExpensesPreviousPeriod,
		topPlan,
		totalDiscountedRevenue,
		totalDiscountedRevenuePreviousPeriod,
		revenueExpensesChartData,
		planDistribution,
		recentActivities,
	};
};
