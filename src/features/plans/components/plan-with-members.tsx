import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, type RouteApi } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { formatDistanceToNow } from "date-fns";
import type { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/datatable";
import { DataTableColumnHeader } from "@/components/ui/datatable-column-header";
import { EmptyState } from "@/components/ui/empty";
import { ErrorBoundaryWithSuspense } from "@/components/ui/error-boundary-with-suspense";
import { DownloadIcon, FolderXIcon } from "@/components/ui/icons";
import { DatatableSkeleton } from "@/components/ui/loaders";
import { Search } from "@/components/ui/search";
import { Skeleton } from "@/components/ui/skeleton";
import { MemberInfo } from "@/features/members/components/member-profile";
import { MemberAvatar } from "@/features/members/components/member-table";
import type { getPlanWithSummary } from "@/features/plans/services/plans.api";
import { planQueries } from "@/features/plans/services/queries";
import { useExportToCsv } from "@/hooks/use-export-to-csv";
import { useFilters } from "@/hooks/use-filters";
import { currencyFormatter, dateFormat } from "@/lib/helpers";
import type { searchValidateSchema } from "@/lib/schema-rules";
import { toTitleCase } from "@/lib/utils";

export function PlanWithMembers() {
	const route = getRouteApi("/app/plans/$planId/view-members");
	const loaderData = route.useLoaderData();

	return (
		<div className="space-y-6">
			<Summary loaderData={loaderData} planId={route.useParams().planId} />
			<Members route={route} />
		</div>
	);
}

type SummaryProps = {
	loaderData: Awaited<ReturnType<typeof getPlanWithSummary>>;
	planId: string;
};

function Summary({ loaderData, planId }: SummaryProps) {
	const { data: planWithSummary } = useQuery(
		planQueries.planWithSummary(planId),
	);
	const { planDetails, activeMembersCount, expiredMembersCount } =
		planWithSummary ?? loaderData;
	return (
		<div className="space-y-4">
			<div className="flex gap-4 flex-col md:flex-row md:items-center md:justify-between">
				<div className="grid gap-1">
					<h2 className="text-lg font-medium capitalize font-display">
						{planDetails.name}
					</h2>
					<p className="text-xs text-muted-foreground max-w-prose">
						{planDetails.description || "No description provided"}
					</p>
				</div>
				<div className="flex flex-col md:flex-row md:items-center gap-2">
					<Badge variant="success">
						{currencyFormatter(planDetails.price)}
					</Badge>
					<p className="text-xs text-muted-foreground">
						Created: {dateFormat(planDetails.createdAt, "long")}
					</p>
				</div>
			</div>
			<div className="max-w-lg grid grid-cols-2 gap-4">
				<MemberInfo
					label="Active Members"
					value={activeMembersCount.toString()}
				/>
				<MemberInfo
					label="Expired in last 30 days"
					value={expiredMembersCount.toString()}
				/>
			</div>
		</div>
	);
}

function Members({
	route,
}: {
	route: RouteApi<"/app/plans/$planId/view-members">;
}) {
	const { setFilters, filters } = useFilters(route.id);
	return (
		<div className="space-y-4 rounded-md p-4 border border-muted">
			<h3 className="font-medium text-sm">Members on this plan</h3>
			<Search
				onHandleSearch={(val) =>
					setFilters({ q: val.trim().length > 1 ? val : undefined })
				}
				defaultValue={filters.q}
				placeholder="Search members..."
			/>
			<ErrorBoundaryWithSuspense
				errorMessage="Error loading plan members"
				loader={
					<div className="flex flex-col gap-4">
						<Skeleton className="w-full md:w-fit h-8 md:self-end" />
						<DatatableSkeleton />
					</div>
				}
			>
				<MembersDatatable route={route} filters={filters} />
			</ErrorBoundaryWithSuspense>
		</div>
	);
}

function MembersDatatable({
	route,
	filters,
}: {
	route: RouteApi<"/app/plans/$planId/view-members">;
	filters: z.infer<typeof searchValidateSchema>;
}) {
	const { data } = useSuspenseQuery(
		planQueries.planWithMembers(route.useParams().planId, filters),
	);
	const { exportToCsv } = useExportToCsv();
	const columns: Array<ColumnDef<(typeof data)[0]>> = [
		{
			accessorKey: "member",
			header: "Member",
			cell: ({
				row: {
					original: { member },
				},
			}) => (
				<div className="flex items-center gap-2">
					<MemberAvatar
						memberName={`${member.firstName} ${member.lastName}`}
						image={member.image}
					/>
					<p>
						{toTitleCase(
							`${member.firstName.toLowerCase()} ${member.lastName.toLowerCase()}`,
						)}
					</p>
				</div>
			),
		},
		{
			accessorKey: "startDate",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Start Date" />
			),
			cell: ({
				row: {
					original: { startDate },
				},
			}) => dateFormat(startDate, "long"),
		},
		{
			accessorKey: "endDate",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="End Date" />
			),
			cell: ({
				row: {
					original: { endDate },
				},
			}) => (endDate ? dateFormat(endDate, "long") : null),
		},
		{
			accessorKey: "priceCharged",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Price Charged" />
			),
			cell: ({
				row: {
					original: { priceCharged },
				},
			}) => (priceCharged ? currencyFormatter(priceCharged) : null),
		},
		{
			accessorKey: "lastAttendance",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Last Attendance" />
			),
			cell: ({
				row: {
					original: { lastAttendance },
				},
			}) =>
				lastAttendance
					? formatDistanceToNow(lastAttendance, { addSuffix: true })
					: `😟 Never`,
		},
	];

	if (data.length === 0) {
		return (
			<EmptyState
				title="No members found"
				description="There are no members associated with this plan yet."
				icon={<FolderXIcon />}
			/>
		);
	}

	return (
		<>
			<div className="flex flex-col gap-4">
				<Button
					variant="outline"
					size="sm"
					onClick={() => {
						const exportData = data.map((item) => ({
							"Member Name": `${item.member.firstName} ${item.member.lastName}`,
							"Start Date": dateFormat(item.startDate, "long"),
							"End Date": item.endDate ? dateFormat(item.endDate, "long") : "",
							"Price Charged": item.priceCharged
								? currencyFormatter(item.priceCharged)
								: "",
							"Last Attendance": item.lastAttendance
								? dateFormat(item.lastAttendance, "long")
								: "",
						}));
						exportToCsv(exportData, "plan-members.csv");
					}}
					className="w-full md:w-fit md:self-end"
				>
					<DownloadIcon />
					Export list
				</Button>
			</div>
			<DataTable data={data} columns={columns} />
		</>
	);
}
