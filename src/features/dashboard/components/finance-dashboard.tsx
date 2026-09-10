import { useSuspenseQuery } from "@tanstack/react-query";
import {
	ArrowUpWideNarrowIcon,
	BadgePercentIcon,
	BanknoteArrowDownIcon,
	HandCoinsIcon,
} from "lucide-react";
import { ErrorBoundaryWithSuspense } from "@/components/ui/error-boundary-with-suspense";
import { ExpenseMtdSheet } from "@/features/dashboard/components/expense-mtd-sheet";
import { OverdueBillsSheet } from "@/features/dashboard/components/overdue-bills-sheet";
import {
	KPICard,
	StatCardsSkeleton,
} from "@/features/dashboard/components/stat-cards";
import { dashboardQueries } from "@/features/dashboard/services/queries";
import { useSheet } from "@/integrations/sheet-provider";
import { currencyFormatter, percentageChangeCalculator } from "@/lib/helpers";
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
	const { setOpen } = useSheet();
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

	function showExpenseBreakdown() {
		setOpen(<ExpenseMtdSheet />, {
			title: "Expenses",
			description:
				"Everything posted to an expense account month to date, including bills and payroll.",
			className: "overflow-y-auto sm:max-w-xl!",
		});
	}

	function showOverdueBills() {
		setOpen(<OverdueBillsSheet />, {
			title: "Overdue Bills",
			description:
				"Bills past their due date, showing the balance still outstanding on each.",
			className: "overflow-y-auto sm:max-w-xl!",
		});
	}

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
				onViewDetails={showExpenseBreakdown}
			/>
			<KPICard
				title="Overdue Bills"
				value={currencyFormatter(totalOverdueBills, false)}
				subtitle="Overdue bills"
				icon={ArrowUpWideNarrowIcon}
				variant="destructive"
				onViewDetails={showOverdueBills}
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
