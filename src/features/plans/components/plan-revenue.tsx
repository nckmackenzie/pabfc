import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, type RouteApi } from "@tanstack/react-router";
import {
	BadgePercentIcon,
	ChartNoAxesCombinedIcon,
	DollarSignIcon,
} from "lucide-react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { DataTable } from "@/components/ui/datatable";
import { EmptyState } from "@/components/ui/empty";
import { ErrorBoundaryWithSuspense } from "@/components/ui/error-boundary-with-suspense";
import { FolderXIcon } from "@/components/ui/icons";
import { DatatableSkeleton } from "@/components/ui/loaders";
import { Search } from "@/components/ui/search";
import { Skeleton } from "@/components/ui/skeleton";
import {
	KPICard,
	StatCardsSkeleton,
} from "@/features/dashboard/components/stat-cards";
import { useColumns } from "@/features/plans/hooks/use-columns";
import { planQueries } from "@/features/plans/services/queries";
import { useFilters } from "@/hooks/use-filters";
import { currencyFormatter, percentage } from "@/lib/helpers";

type PlanRevenueProps = {
	planId: string;
	route: RouteApi<"/app/plans/$planId/revenue">;
};

export function PlanRevenue() {
	const route = getRouteApi("/app/plans/$planId/revenue");
	const { planId } = route.useParams();
	return (
		<div className="space-y-6">
			<ErrorBoundaryWithSuspense
				errorMessage="Unable to load plan revenue stats"
				loader={<StatCardsSkeleton />}
			>
				<StatCards planId={planId} route={route} />
			</ErrorBoundaryWithSuspense>
			<ErrorBoundaryWithSuspense
				errorMessage="Unable to load plan revenue payments"
				loader={
					<Card>
						<CardContent>
							<Skeleton className="h-10 max-w-sm" />
							<DatatableSkeleton />
						</CardContent>
					</Card>
				}
			>
				<PaymentsTable planId={planId} route={route} />
			</ErrorBoundaryWithSuspense>
		</div>
	);
}

function StatCards({ planId, route }: PlanRevenueProps) {
	const { filters } = useFilters(route.id);
	const {
		data: { revenueThisMonth, averagePayment, totalPayment, totalPlanPayment },
	} = useSuspenseQuery(planQueries.planRevenueStats(planId, filters));

	return (
		<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
			<KPICard
				title="Total Revenue"
				value={currencyFormatter(totalPlanPayment, false)}
				icon={DollarSignIcon}
			/>
			<KPICard
				title="Average Payment"
				value={currencyFormatter(averagePayment, false)}
				icon={ChartNoAxesCombinedIcon}
			/>
			<KPICard
				title="Revenue share"
				value={`${percentage(totalPlanPayment, totalPayment)}%`}
				icon={BadgePercentIcon}
			/>
			<KPICard
				title="Revenue this month"
				value={currencyFormatter(revenueThisMonth, false)}
				icon={BadgePercentIcon}
			/>
		</div>
	);
}

function PaymentsTable({ planId, route }: PlanRevenueProps) {
	const { filters, setFilters } = useFilters(route.id);
	const { data } = useSuspenseQuery(
		planQueries.planRevenuePayments(planId, filters),
	);
	const { paymentsColumns } = useColumns();
	return (
		<Card>
			<CardHeader>
				<CardTitle>Payments</CardTitle>
				<CardDescription>List of payments for this plan.</CardDescription>
			</CardHeader>
			<CardContent>
				{data.length > 0 ? (
					<div className="space-y-4">
						<Search
							placeholder="Search payments..."
							onHandleSearch={(val) =>
								setFilters({
									q: val.trim().length > 0 ? val.trim() : undefined,
								})
							}
						/>
						<DataTable columns={paymentsColumns} data={data} />
					</div>
				) : (
					<EmptyState
						title="No payments found"
						description="There are no payments associated with this plan yet."
						icon={<FolderXIcon />}
					/>
				)}
			</CardContent>
		</Card>
	);
}
