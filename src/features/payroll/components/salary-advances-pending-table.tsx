import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { ViewDetailsAction } from "@/components/ui/custom-button";
import { DataTable } from "@/components/ui/datatable";
import { DatatableActions } from "@/components/ui/datatable-actions";
import { DataTableColumnHeader } from "@/components/ui/datatable-column-header";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty";
import { FileSpreadsheetIcon } from "@/components/ui/icons";
import { PermissionGate } from "@/components/ui/permission-gate";
import { SALARY_ADVANCE_STATUS_VARIANTS } from "@/features/payroll/lib/salary-advance-options";
import type { SalaryAdvancePendingListItem } from "@/features/payroll/services/salary-advances.api";
import { salaryAdvanceQueries } from "@/features/payroll/services/queries";
import { currencyFormatter } from "@/lib/helpers";

function getSalaryAdvanceStatusVariant(status: string) {
	return SALARY_ADVANCE_STATUS_VARIANTS[
		status as keyof typeof SALARY_ADVANCE_STATUS_VARIANTS
	];
}

function PendingAdvanceActions({ advance }: { advance: SalaryAdvancePendingListItem }) {
	return (
		<DatatableActions>
			<PermissionGate permission="salary-advances:view">
				<DropdownMenuItem asChild>
					<Link to="/app/payroll/salary-advances/$advanceId" params={{ advanceId: advance.id }}>
						<ViewDetailsAction />
					</Link>
				</DropdownMenuItem>
			</PermissionGate>
		</DatatableActions>
	);
}

export function SalaryAdvancesPendingTable() {
	const { data } = useSuspenseQuery(salaryAdvanceQueries.pending());

	const columns: Array<ColumnDef<SalaryAdvancePendingListItem>> = [
		{
			accessorKey: "employeeNo",
			header: ({ column }) => <DataTableColumnHeader column={column} title="Employee No" />,
			cell: ({ row }) => <span className="font-mono">E{row.original.employeeNo}</span>,
		},
		{
			accessorKey: "fullName",
			header: ({ column }) => <DataTableColumnHeader column={column} title="Employee" />,
		},
		{
			accessorKey: "departmentName",
			header: "Department",
			cell: ({ row }) => row.original.departmentName ?? "-",
		},
		{
			accessorKey: "requestedAmount",
			header: "Requested Amount",
			cell: ({ row }) => currencyFormatter(row.original.requestedAmount),
		},
		{
			accessorKey: "requestedRecoveryMonths",
			header: "Recovery Months",
		},
		{
			accessorKey: "status",
			header: "Status",
			cell: ({ row }) => (
				<Badge
					variant={getSalaryAdvanceStatusVariant(row.original.status)}
					className="capitalize"
				>
					{row.original.status.replaceAll("_", " ")}
				</Badge>
			),
		},
		{
			id: "actions",
			cell: ({ row }) => <PendingAdvanceActions advance={row.original} />,
		},
	];

	if (!data.length) {
		return (
			<EmptyState
				title="No Pending Salary Advances"
				description="Pending salary advance applications will appear here for HR review."
				icon={<FileSpreadsheetIcon />}
			/>
		);
	}

	return <DataTable columns={columns} data={data} />;
}
