import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { CalendarClockIcon } from "lucide-react";
import { DataTable } from "@/components/ui/datatable";
import { EmptyState } from "@/components/ui/empty";
import { TableSkeleton } from "@/components/ui/loaders";
import { getMembershipExpiryStatus } from "@/features/dashboard/lib/helpers";
import type { getExpiringMemberships } from "@/features/dashboard/services/dashboard.api";
import { dashboardQueries } from "@/features/dashboard/services/queries";

type ExpiringMembershipRow = Awaited<ReturnType<typeof getExpiringMemberships>>[number];

const columns: Array<ColumnDef<ExpiringMembershipRow>> = [
	{
		accessorKey: "memberName",
		header: "Member",
		cell: ({ row }) => (
			<span className="font-medium capitalize">{row.original.memberName}</span>
		),
	},
	{
		accessorKey: "memberNo",
		header: "Member No",
	},
	{
		accessorKey: "planName",
		header: "Current Plan",
		cell: ({ row }) => (
			<span className="capitalize">{row.original.planName ?? "—"}</span>
		),
	},
	{
		id: "daysRemaining",
		header: "Days Remaining",
		cell: ({ row }) => getMembershipExpiryStatus(row.original.endDate)?.label ?? "—",
	},
];

export function ExpiringSoonSheet() {
	const {
		data: expiringMemberships,
		isError,
		isLoading,
	} = useQuery(dashboardQueries.expiringMemberships());

	if (isLoading) {
		return (
			<div className="p-4">
				<TableSkeleton rowCount={5} columnWidths={["w-36", "w-20", "w-28", "w-32"]} />
			</div>
		);
	}

	if (isError) {
		return (
			<EmptyState
				icon={<CalendarClockIcon />}
				title="Unable to load expiring memberships"
				description="Close the sheet and try again."
			/>
		);
	}

	if (!expiringMemberships?.length) {
		return (
			<EmptyState
				icon={<CalendarClockIcon />}
				title="No expiring memberships"
				description="No memberships are expiring soon."
			/>
		);
	}

	return (
		<div className="p-4">
			<DataTable columns={columns} data={expiringMemberships} />
		</div>
	);
}
