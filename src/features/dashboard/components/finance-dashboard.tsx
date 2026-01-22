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
import { percentageChangeCalculator } from "@/lib/helpers";
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
			topPlan,
			totalDiscountedRevenue,
			totalDiscountedRevenuePreviousPeriod,
		},
	} = useSuspenseQuery(dashboardQueries.financeStats());
	return (
		<div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<KPICard
				title="Membership Revenue"
				value={totalRevenueLast30Days.toLocaleString()}
				subtitle="Membership revenue in last 30 days"
				icon={HandCoinsIcon}
				trend={percentageChangeCalculator(
					totalRevenueLast30Days,
					totalRevenuePreviousPeriod,
				)}
				variant="default"
			/>
			<KPICard
				title="Expenses"
				value={totalExpensesLast30Days.toLocaleString()}
				subtitle="Expenses in last 30 days"
				icon={BanknoteArrowDownIcon}
				trend={percentageChangeCalculator(
					totalExpensesLast30Days,
					totalExpensesPreviousPeriod,
				)}
				variant="destructive"
			/>
			<KPICard
				title="Top Plan"
				value={topPlan?.planName || "N/A"}
				subtitle={`${topPlan?.amount || 0} revenue`}
				icon={ArrowUpWideNarrowIcon}
				variant="default"
			/>
			<KPICard
				title="Discounted Revenue"
				value={totalDiscountedRevenue.toLocaleString()}
				subtitle="Discounted revenue in last 30 days"
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
