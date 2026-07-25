import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Users2Icon } from "lucide-react";
import { DataTable } from "@/components/ui/datatable";
import { EmptyState } from "@/components/ui/empty";
import { TableSkeleton } from "@/components/ui/loaders";
import type { getActiveMemberships } from "@/features/dashboard/services/dashboard.api";
import { dashboardQueries } from "@/features/dashboard/services/queries";

type ActiveMembershipRow = Awaited<ReturnType<typeof getActiveMemberships>>[number];

const columns: Array<ColumnDef<ActiveMembershipRow>> = [
	{
		accessorKey: "fullName",
		header: "Member",
		cell: ({ row }) => (
			<span className="font-medium capitalize">{row.original.fullName}</span>
		),
	},
	{
		accessorKey: "memberNo",
		header: "Member No",
	},
	{
		accessorKey: "activePlanName",
		header: "Current Plan",
		cell: ({ row }) => (
			<span className="capitalize">{row.original.activePlanName ?? "—"}</span>
		),
	},
];

export function ActiveMembersSheet() {
	const {
		data: activeMemberships,
		isError,
		isLoading,
	} = useQuery(dashboardQueries.activeMemberships());

	if (isLoading) {
		return (
			<div className="p-4">
				<TableSkeleton rowCount={5} columnWidths={["w-36", "w-20", "w-28"]} />
			</div>
		);
	}

	if (isError) {
		return (
			<EmptyState
				icon={<Users2Icon />}
				title="Unable to load active members"
				description="Close the sheet and try again."
			/>
		);
	}

	if (!activeMemberships?.length) {
		return (
			<EmptyState
				icon={<Users2Icon />}
				title="No active members"
				description="There are no members with an active membership."
			/>
		);
	}

	return (
		<div className="p-4">
			<DataTable columns={columns} data={activeMemberships} />
		</div>
	);
}
