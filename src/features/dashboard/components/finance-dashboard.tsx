import { useSuspenseQuery } from "@tanstack/react-query";
import {
	ArrowUpWideNarrowIcon,
	BadgePercentIcon,
	BanknoteArrowDownIcon,
	HandCoinsIcon,
} from "lucide-react";
import { ErrorBoundaryWithSuspense } from "@/components/ui/error-boundary-with-suspense";
import {
	KPICard,
	StatCardsSkeleton,
} from "@/features/dashboard/components/stat-cards";
import { dashboardQueries } from "@/features/dashboard/services/queries";
import {
	currencyFormatter,
	dateFormat,
	percentageChangeCalculator,
} from "@/lib/helpers";
import { getFinanceStatDates } from "../lib/helpers";
import { FinanceAreaChart, FinancePieChart } from "./finance-charts";
import { FinanceRecentTransactions } from "./finance-recent-transactions";

export function FinanceDashboard() {
	return (
		<div className="mb-6">
			<ErrorBoundaryWithSuspense
				loader={<StatCardsSkeleton />}
				errorMessage="Failed to load stats"
			>
				<FinanceStatCards />
			</ErrorBoundaryWithSuspense>

			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
				<div className="col-span-4">
					<ErrorBoundaryWithSuspense
						loader={
							<div className="h-[300px] w-full animate-pulse rounded-xl bg-muted" />
						}
						errorMessage="Failed to load chart"
					>
						<FinanceAreaChart />
					</ErrorBoundaryWithSuspense>
				</div>
				<div className="col-span-3">
					<ErrorBoundaryWithSuspense
						loader={
							<div className="h-[300px] w-full animate-pulse rounded-xl bg-muted" />
						}
						errorMessage="Failed to load chart"
					>
						<FinancePieChart />
					</ErrorBoundaryWithSuspense>
				</div>
			</div>
			<div className="mt-4">
				<ErrorBoundaryWithSuspense
					loader={
						<div className="h-[300px] w-full animate-pulse rounded-xl bg-muted" />
					}
					errorMessage="Failed to load transactions"
				>
					<FinanceRecentTransactions />
				</ErrorBoundaryWithSuspense>
			</div>
		</div>
	);
}

function FinanceStatCards() {
	const {
		data: {
			totalExpensesLast30Days,
			totalExpensesPreviousPeriod,
			totalRevenueLast30Days,
			totalRevenuePreviousPeriod,
			totalOverdueBills,
			totalDiscountedRevenue,
			totalDiscountedRevenuePreviousPeriod,
		},
	} = useSuspenseQuery(dashboardQueries.financeStats());
	const { currentPeriodStart, currentPeriodEnd } = getFinanceStatDates();
	return (
		<div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<KPICard
				title="Membership Revenue"
				value={currencyFormatter(totalRevenueLast30Days, false)}
				subtitle="Membership revenue month to date"
				icon={HandCoinsIcon}
				trend={percentageChangeCalculator(
					totalRevenueLast30Days,
					totalRevenuePreviousPeriod,
				)}
				variant="default"
			/>
			<KPICard
				title="Expenses"
				value={currencyFormatter(totalExpensesLast30Days, false)}
				subtitle="Expenses month to date"
				icon={BanknoteArrowDownIcon}
				trend={percentageChangeCalculator(
					totalExpensesLast30Days,
					totalExpensesPreviousPeriod,
				)}
				variant="destructive"
				link={{
					to: "/app/expenses",
					search: {
						from: dateFormat(currentPeriodStart),
						to: dateFormat(currentPeriodEnd),
					},
				}}
			/>
			<KPICard
				title="Overdue Bills"
				value={currencyFormatter(totalOverdueBills, false)}
				subtitle="Overdue bills"
				icon={ArrowUpWideNarrowIcon}
				variant="destructive"
				link={{ to: "/app/bills", search: { status: "overdue" } }}
			/>
			<KPICard
				title="Discounted Revenue"
				value={currencyFormatter(totalDiscountedRevenue, false)}
				subtitle="Discounted revenue month to date"
				icon={BadgePercentIcon}
				trend={percentageChangeCalculator(
					totalDiscountedRevenue,
					totalDiscountedRevenuePreviousPeriod,
				)}
				variant="default"
			/>
		</div>
	);
}
