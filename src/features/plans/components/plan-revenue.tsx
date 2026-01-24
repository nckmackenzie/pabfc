/** biome-ignore-all lint/correctness/useUniqueElementIds: <> */
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, type RouteApi } from "@tanstack/react-router";
import {
	BadgePercentIcon,
	ChartNoAxesCombinedIcon,
	DollarSignIcon,
} from "lucide-react";
import {
	Area,
	AreaChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
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
import { DownloadIcon, FolderXIcon } from "@/components/ui/icons";
import { DatatableSkeleton } from "@/components/ui/loaders";
import { Search } from "@/components/ui/search";
import { Skeleton } from "@/components/ui/skeleton";
import {
	KPICard,
	StatCardsSkeleton,
} from "@/features/dashboard/components/stat-cards";
import { useColumns } from "@/features/plans/hooks/use-columns";
import { planQueries } from "@/features/plans/services/queries";
import { useExportToCsv } from "@/hooks/use-export-to-csv";
import { useFilters } from "@/hooks/use-filters";
import { currencyFormatter, dateFormat, percentage } from "@/lib/helpers";

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
				errorMessage="Unable to load plan revenue trend"
				loader={<Skeleton className="h-64" />}
			>
				<RevenueChart planId={planId} route={route} />
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
	const { exportToCsv } = useExportToCsv();
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
							defaultValue={filters.q}
							onHandleSearch={(val) =>
								setFilters({
									q: val.trim().length > 0 ? val.trim() : undefined,
								})
							}
						/>
						<div className="flex flex-col gap-4">
							<Button
								variant="outline"
								size="sm"
								className="w-full md:w-fit md:self-end"
								onClick={() => {
									const exportData = data.map((payment) => ({
										Member: `${payment.member.firstName} ${payment.member.lastName}`,
										"Payment Date": dateFormat(payment.paymentDate, "long"),
										Amount: currencyFormatter(payment.amount, false),
										"Payment Method": payment.paymentMethod.toUpperCase(),
										Reference: payment.reference?.toUpperCase(),
									}));
									exportToCsv(exportData, "payments");
								}}
							>
								<DownloadIcon />
								Export list
							</Button>
							<DataTable columns={paymentsColumns} data={data} />
						</div>
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

function RevenueChart({ planId, route }: PlanRevenueProps) {
	const { filters } = useFilters(route.id);
	const { data: trendData } = useSuspenseQuery(
		planQueries.planRevenueTrend(planId, filters),
	);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Revenue Trend</CardTitle>
				<CardDescription>Monthly revenue for this plan</CardDescription>
			</CardHeader>
			<CardContent className="h-64">
				{trendData.length > 0 ? (
					<ResponsiveContainer width="100%" height="100%">
						<AreaChart
							data={trendData}
							margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
						>
							<defs>
								<linearGradient
									id="revenueGradient"
									x1="0"
									y1="0"
									x2="0"
									y2="1"
								>
									<stop
										offset="0%"
										stopColor="hsl(174 72% 40%)"
										stopOpacity={0.3}
									/>
									<stop
										offset="100%"
										stopColor="hsl(174 72% 40%)"
										stopOpacity={0}
									/>
								</linearGradient>
							</defs>
							<XAxis
								dataKey="label"
								axisLine={false}
								tickLine={false}
								tick={{ fill: "hsl(220 10% 45%)", fontSize: 12 }}
								dy={10}
							/>
							<YAxis
								axisLine={false}
								tickLine={false}
								tick={{ fill: "hsl(220 10% 45%)", fontSize: 12 }}
								tickFormatter={(value) => `${value / 1000}k`}
								dx={-10}
							/>
							<Tooltip
								contentStyle={{
									backgroundColor: "hsl(0 0% 100%)",
									border: "1px solid hsl(220 13% 88%)",
									borderRadius: "8px",
									boxShadow: "0 4px 6px -1px hsl(220 20% 10% / 0.1)",
								}}
								formatter={(value: number) => [
									`${value.toLocaleString()}`,
									"Revenue",
								]}
								labelStyle={{ color: "hsl(220 30% 10%)" }}
							/>
							<Area
								type="monotone"
								dataKey="value"
								stroke="hsl(174 72% 40%)"
								strokeWidth={2}
								fill="url(#revenueGradient)"
							/>
						</AreaChart>
					</ResponsiveContainer>
				) : (
					<EmptyState
						title="No revenue trend found"
						description="There is no revenue trend data for this plan yet."
						icon={<FolderXIcon />}
					/>
				)}
			</CardContent>
		</Card>
	);
}
