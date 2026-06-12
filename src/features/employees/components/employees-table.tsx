import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { EditAction } from "@/components/ui/custom-button";
import { DataTable } from "@/components/ui/datatable";
import { DatatableActions } from "@/components/ui/datatable-actions";
import { DataTableColumnHeader } from "@/components/ui/datatable-column-header";
import { DeleteActionButton } from "@/components/ui/delete-action";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty";
import { Users2Icon } from "@/components/ui/icons";
import { PermissionGate } from "@/components/ui/permission-gate";
import {
	deleteEmployee,
	type EmployeeListItem,
} from "@/features/employees/services/employees.api";
import { employeeQueries } from "@/features/employees/services/queries";
import { formatText } from "@/features/employees/utils/helpers";
import { useFilters } from "@/hooks/use-filters";
import { toTitleCase } from "@/lib/utils";

const statusVariantMap = {
	active: "success",
	on_leave: "warning",
	terminated: "danger",
	resigned: "secondary",
} as const;

export function EmployeesTable() {
	const { filters } = useFilters(getRouteApi("/app/employees/").id);
	const { data: employees } = useSuspenseQuery(employeeQueries.list(filters));

	const columns: Array<ColumnDef<EmployeeListItem>> = [
		{
			accessorKey: "employeeNo",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Employee No" />
			),
			cell: ({ row }) => (
				<span className="font-mono">E{row.original.employeeNo}</span>
			),
		},
		{
			accessorKey: "firstName",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="First Name" />
			),
			cell: ({ row }) => `${toTitleCase(row.original.firstName)}`,
		},
		{
			accessorKey: "jobTitle",
			header: "Job Title",
			cell: ({ row }) => row.original.jobTitle ?? "-",
		},
		{
			accessorKey: "employmentType",
			header: "Employment Type",
			cell: ({ row }) => formatText(row.original.employmentType),
		},
		{
			accessorKey: "status",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Status" />
			),
			cell: ({ row }) => (
				<Badge
					variant={statusVariantMap[row.original.status]}
					className="uppercase"
				>
					{formatText(row.original.status)}
				</Badge>
			),
		},
		{
			id: "actions",
			cell: ({ row }) => (
				<DatatableActions>
					<PermissionGate permission="employees:update">
						<DropdownMenuItem asChild>
							<Link
								to="/app/employees/$employeeId/edit"
								params={{ employeeId: row.original.id }}
							>
								<EditAction />
							</Link>
						</DropdownMenuItem>
					</PermissionGate>
					<PermissionGate permission="employees:delete">
						<DeleteActionButton
							queryKey={["members"]}
							resourceId={row.original.id}
							deleteAction={deleteEmployee}
						/>
					</PermissionGate>
				</DatatableActions>
			),
		},
	];

	if (!employees.length && !filters?.q) {
		return (
			<EmptyState
				title="No Employees"
				description="There are no employees created yet."
				buttonName="Create Employee"
				path="/app/employees/new"
				icon={<Users2Icon />}
			/>
		);
	}

	return <DataTable columns={columns} data={employees} />;
}
