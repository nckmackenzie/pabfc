import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { DataTable } from "@/components/ui/datatable";
import { DataTableColumnHeader } from "@/components/ui/datatable-column-header";
import type { attendanceOverview } from "@/drizzle/schema";
import { attendanceQueries } from "@/features/attendances/services/queries";
import { MemberAvatar } from "@/features/members/components/member-table";
import { useFilters } from "@/hooks/use-filters";
import { toTitleCase } from "@/lib/utils";

const columns: Array<ColumnDef<typeof attendanceOverview.$inferSelect>> = [
	{
		accessorKey: "memberName",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Member" />
		),
		cell: ({
			row: {
				original: { memberName, image },
			},
		}) => {
			return (
				<div className="flex items-center gap-2">
					<MemberAvatar memberName={memberName} image={image} />
					<span>{toTitleCase(memberName)}</span>
				</div>
			);
		},
	},
	{
		accessorKey: "checkInTime",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Check In" />
		),
		cell: ({ row }) => (
			<div>{format(row.original.checkInTime, "dd-MM-yyyy HH:mm:ss")}</div>
		),
	},
	{
		accessorKey: "checkOutTime",
		header: ({ column }) => (
			<DataTableColumnHeader column={column} title="Check Out" />
		),
		cell: ({
			row: {
				original: { checkOutTime },
			},
		}) => (
			<div>
				{checkOutTime ? format(checkOutTime, "dd-MM-yyyy HH:mm:ss") : "-"}
			</div>
		),
	},
	{
		accessorKey: "duration",
		header: "Duration",
	},
];

export function AttendanceTable() {
	const { filters } = useFilters(getRouteApi("/app/attendances/").id);
	const { data } = useSuspenseQuery(attendanceQueries.list(filters));
	return <DataTable data={data} columns={columns} />;
}
