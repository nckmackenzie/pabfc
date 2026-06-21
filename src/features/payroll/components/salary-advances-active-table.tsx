import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, getRouteApi } from "@tanstack/react-router";
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
import { formatPayrollPeriod } from "@/features/payroll/lib/overtime-options";
import { SALARY_ADVANCE_STATUS_VARIANTS } from "@/features/payroll/lib/salary-advance-options";
import type { SalaryAdvanceActiveListItem } from "@/features/payroll/services/salary-advances.api";
import { salaryAdvanceQueries } from "@/features/payroll/services/queries";
import { useFilters } from "@/hooks/use-filters";
import { currencyFormatter } from "@/lib/helpers";

function getSalaryAdvanceStatusVariant(status: string) {
	return SALARY_ADVANCE_STATUS_VARIANTS[
		status as keyof typeof SALARY_ADVANCE_STATUS_VARIANTS
	];
}

function ActiveAdvanceActions({ advance }: { advance: SalaryAdvanceActiveListItem }) {
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

export function SalaryAdvancesActiveTable() {
	const { filters } = useFilters(getRouteApi("/app/payroll/salary-advances/").id);
	const { data } = useSuspenseQuery(
		salaryAdvanceQueries.active({
			departmentId: filters.departmentId,
			employeeId: filters.employeeId,
		})
	);

	const columns: Array<ColumnDef<SalaryAdvanceActiveListItem>> = [
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
			accessorKey: "approvedAmount",
			header: "Approved Amount",
			cell: ({ row }) => currencyFormatter(row.original.approvedAmount ?? 0),
		},
		{
			accessorKey: "outstandingBalance",
			header: "Outstanding",
			cell: ({ row }) => currencyFormatter(row.original.outstandingBalance ?? 0),
		},
		{
			accessorKey: "monthlyRecoveryAmount",
			header: "Monthly Recovery",
			cell: ({ row }) => currencyFormatter(row.original.monthlyRecoveryAmount ?? 0),
		},
		{
			id: "recoveryStart",
			header: "Recovery Start",
			cell: ({ row }) =>
				row.original.recoveryStartMonth && row.original.recoveryStartYear
					? formatPayrollPeriod(
							row.original.recoveryStartMonth,
							row.original.recoveryStartYear
						)
					: "-",
		},
		{
			accessorKey: "remainingRecoveries",
			header: "Recoveries Left",
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
			cell: ({ row }) => <ActiveAdvanceActions advance={row.original} />,
		},
	];

	if (!data.length) {
		return (
			<EmptyState
				title="No Active Salary Advances"
				description="Disbursed or recovering salary advances will appear here."
				icon={<FileSpreadsheetIcon />}
			/>
		);
	}

	return <DataTable columns={columns} data={data} />;
}
