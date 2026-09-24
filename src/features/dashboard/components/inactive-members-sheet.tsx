import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { UserXIcon } from "lucide-react";
import { DataTable } from "@/components/ui/datatable";
import { EmptyState } from "@/components/ui/empty";
import { TableSkeleton } from "@/components/ui/loaders";
import type { getInactiveMembers } from "@/features/dashboard/services/dashboard.api";
import { dashboardQueries } from "@/features/dashboard/services/queries";
import { dateFormat } from "@/lib/helpers";

type InactiveMemberRow = Awaited<ReturnType<typeof getInactiveMembers>>[number];

const columns: Array<ColumnDef<InactiveMemberRow>> = [
	{
		accessorKey: "fullName",
		header: "Member",
		cell: ({ row }) => (
			<div className="grid">
				<span className="font-medium capitalize">{row.original.fullName}</span>
				<span className="text-xs text-muted-foreground">{row.original.contact}</span>
			</div>
		),
	},
	{
		accessorKey: "memberNo",
		header: "Member No",
	},
	{
		accessorKey: "lastPlanName",
		header: "Last Plan",
		cell: ({ row }) => <span className="capitalize">{row.original.lastPlanName ?? "—"}</span>,
	},
	{
		accessorKey: "lastVisit",
		header: "Last Visit",
		cell: ({ row }) =>
			row.original.lastVisit ? dateFormat(row.original.lastVisit, "long") : "Never",
	},
	{
		accessorKey: "deactivatedAt",
		header: "Inactive Since",
		cell: ({ row }) =>
			row.original.deactivatedAt ? dateFormat(row.original.deactivatedAt, "long") : "—",
	},
];

export function InactiveMembersSheet() {
	const {
		data: inactiveMembers,
		isError,
		isLoading,
	} = useQuery(dashboardQueries.inactiveMembers());

	if (isLoading) {
		return (
			<div className="p-4">
				<TableSkeleton rowCount={5} columnWidths={["w-36", "w-20", "w-28", "w-28", "w-28"]} />
			</div>
		);
	}

	if (isError) {
		return (
			<EmptyState
				icon={<UserXIcon />}
				title="Unable to load inactive members"
				description="Close the sheet and try again."
			/>
		);
	}

	if (!inactiveMembers?.length) {
		return (
			<EmptyState
				icon={<UserXIcon />}
				title="No inactive members"
				description="All members are currently active."
			/>
		);
	}

	return (
		<div className="p-4">
			<DataTable columns={columns} data={inactiveMembers} />
		</div>
	);
}
