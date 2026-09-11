import { describe, expect, it } from "vitest";
import {
	buildFinanceChartData,
	buildFinanceMockData,
	getCurrentFinanceExpenseFilterParams,
	getCurrentFinancePaymentFilterParams,
	mergeRecentFinanceTransactions,
	shouldUseFinanceMockData,
} from "./finance-data";

describe("getCurrentFinancePaymentFilterParams", () => {
	it("uses the current month-to-date range for completed membership payments", () => {
		const now = new Date("2026-08-26T10:15:30.000Z");

		const filters = getCurrentFinancePaymentFilterParams(now);

		expect(filters.dateFrom).toEqual(new Date("2026-07-31T21:00:00.000Z"));
		expect(filters.dateTo).toBe(now);
		expect(filters.status).toBe("completed");
	});

	it("uses Nairobi month boundaries when the server runs in UTC", () => {
		const originalTimeZone = process.env.TZ;
		process.env.TZ = "UTC";

		try {
			const filters = getCurrentFinancePaymentFilterParams(new Date("2026-07-31T22:00:00.000Z"));

			expect(filters.dateFrom).toEqual(new Date("2026-07-31T21:00:00.000Z"));
		} finally {
			if (originalTimeZone === undefined) {
				delete process.env.TZ;
			} else {
				process.env.TZ = originalTimeZone;
			}
		}
	});

	it("uses Nairobi calendar dates for expense filters when the server runs in UTC", () => {
		const originalTimeZone = process.env.TZ;
		process.env.TZ = "UTC";

		try {
			const filters = getCurrentFinanceExpenseFilterParams(new Date("2026-07-31T22:00:00.000Z"));

			expect(filters).toEqual({ dateFrom: "2026-08-01", dateTo: "2026-08-01" });
		} finally {
			if (originalTimeZone === undefined) {
				delete process.env.TZ;
			} else {
				process.env.TZ = originalTimeZone;
			}
		}
	});
});

describe("shouldUseFinanceMockData", () => {
	it("uses mocks only in development when both MTD datasets are empty", () => {
		expect(shouldUseFinanceMockData(false, 0, 0)).toBe(true);
		expect(shouldUseFinanceMockData(false, 0, 1)).toBe(false);
		expect(shouldUseFinanceMockData(false, 1, 0)).toBe(false);
		expect(shouldUseFinanceMockData(true, 0, 0)).toBe(false);
	});
});

describe("buildFinanceChartData", () => {
	it("combines MTD revenue and expense totals without dropping unmatched dates", () => {
		const data = buildFinanceChartData(
			[
				{ date: "2026-08-01", amount: 1500 },
				{ date: "2026-08-03", amount: 750 },
			],
			[
				{ date: "2026-08-02", amount: 400 },
				{ date: "2026-08-03", amount: 250 },
			]
		);

		expect(data).toEqual([
			{ date: "Aug 01", revenue: 1500, expenses: 0 },
			{ date: "Aug 02", revenue: 0, expenses: 400 },
			{ date: "Aug 03", revenue: 750, expenses: 250 },
		]);
	});
});

describe("mergeRecentFinanceTransactions", () => {
	it("returns the ten newest MTD income and expense transactions", () => {
		const income = Array.from({ length: 7 }, (_, index) => ({
			date: new Date(`2026-08-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`),
			type: "income" as const,
			amount: index + 1,
			reference: `PAY-${index + 1}`,
			entity: `Member ${index + 1}`,
			status: "completed",
		}));
		const expenses = Array.from({ length: 7 }, (_, index) => ({
			date: `2026-08-${String(index + 8).padStart(2, "0")}`,
			type: "expense" as const,
			amount: index + 8,
			reference: `EXP-${index + 8}`,
			entity: `Payee ${index + 8}`,
			status: "completed",
		}));

		const data = mergeRecentFinanceTransactions(income, expenses);

		expect(data).toHaveLength(10);
		expect(data[0]?.reference).toBe("EXP-14");
		expect(data[9]?.reference).toBe("PAY-5");
	});
});

describe("buildFinanceMockData", () => {
	const MOCK_TODAY = new Date("2026-08-26T10:15:30.000Z");

	it("keeps mock plan distribution equal to mock membership revenue", () => {
		const data = buildFinanceMockData(MOCK_TODAY);

		expect(data.planDistribution.reduce((total, plan) => total + plan.value, 0)).toBe(
			data.totalRevenueLast30Days
		);
		expect(data.revenueExpensesChartData).toHaveLength(26);
	});

	// The Expenses stat card reads `totalExpensesLast30Days` and its drill-down
	// sheet reads `expenseBreakdown`. Under mock data the sheet used to come back
	// empty while the card still showed a figure.
	it("keeps the mock expense breakdown equal to the mock expenses total", () => {
		const data = buildFinanceMockData(MOCK_TODAY);

		expect(data.expenseBreakdown.length).toBeGreaterThan(0);
		expect(data.expenseBreakdown.reduce((total, row) => total + row.amount, 0)).toBe(
			data.totalExpensesLast30Days
		);
	});

	it("matches the mock expense breakdown to the chart series day for day", () => {
		const data = buildFinanceMockData(MOCK_TODAY);

		expect(data.expenseBreakdown).toHaveLength(data.revenueExpensesChartData.length);
		expect([...data.expenseBreakdown].reverse().map((row) => row.amount)).toEqual(
			data.revenueExpensesChartData.map((row) => row.expenses)
		);
	});

	it("lists mock expense breakdown rows newest first", () => {
		const dates = buildFinanceMockData(MOCK_TODAY).expenseBreakdown.map((row) => row.date);

		expect(dates).toEqual([...dates].sort().reverse());
	});

	// `getOverdueBillsBreakdown` returns no rows under mock data, so the card it
	// sits behind has to read zero.
	it("reports no overdue bills, matching its empty breakdown", () => {
		expect(buildFinanceMockData(MOCK_TODAY).totalOverdueBills).toBe(0);
	});
});
