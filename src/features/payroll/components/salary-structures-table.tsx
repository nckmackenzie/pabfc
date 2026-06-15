import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { ViewDetailsAction } from "@/components/ui/custom-button";
import { DataTable } from "@/components/ui/datatable";
import { DatatableActions } from "@/components/ui/datatable-actions";
import { DataTableColumnHeader } from "@/components/ui/datatable-column-header";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty";
import { CalculatorIcon } from "@/components/ui/icons";
import { PermissionGate } from "@/components/ui/permission-gate";
import type { SalaryStructureDirectoryListItem } from "@/features/payroll/services/salary-structures.api";
import { salaryStructureQueries } from "@/features/payroll/services/queries";
import { useFilters } from "@/hooks/use-filters";
import { currencyFormatter } from "@/lib/helpers";
import { toTitleCase } from "@/lib/utils";

const structureStatusVariant = {
	configured: "success",
	missing: "warning",
} as const;

export function SalaryStructuresTable() {
	const { filters } = useFilters(
		getRouteApi("/app/payroll/salary-structures/").id,
	);
	const { data } = useSuspenseQuery(salaryStructureQueries.directory(filters));

	const columns: Array<ColumnDef<SalaryStructureDirectoryListItem>> = [
		{
			accessorKey: "employeeNo",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Employee No" />
			),
			cell: ({ row }) => <span className="font-mono">E{row.original.employeeNo}</span>,
		},
		{
			accessorKey: "fullName",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Employee" />
			),
			cell: ({ row }) => toTitleCase(row.original.fullName),
		},
		{
			accessorKey: "jobTitle",
			header: "Job Title",
			cell: ({ row }) => row.original.jobTitle ?? "-",
		},
		{
			accessorKey: "currentGrossPay",
			header: "Current Gross Pay",
			cell: ({ row }) =>
				row.original.currentGrossPay === null
					? "-"
					: currencyFormatter(row.original.currentGrossPay),
		},
		{
			accessorKey: "currentEffectiveFrom",
			header: "Effective From",
			cell: ({ row }) => row.original.currentEffectiveFrom ?? "-",
		},
		{
			accessorKey: "currentPayFrequency",
			header: "Pay Frequency",
			cell: ({ row }) =>
				row.original.currentPayFrequency
					? toTitleCase(row.original.currentPayFrequency.replace("_", " "))
					: "-",
		},
		{
			accessorKey: "structureStatus",
			header: "Structure Status",
			cell: ({ row }) => (
				<Badge variant={structureStatusVariant[row.original.structureStatus]}>
					{toTitleCase(row.original.structureStatus)}
				</Badge>
			),
		},
		{
			id: "actions",
			cell: ({ row }) => (
				<DatatableActions>
					<PermissionGate permission="salary-structures:view">
						<DropdownMenuItem asChild>
							<Link
								to="/app/payroll/salary-structures/employee/$employeeId"
								params={{ employeeId: row.original.id }}
							>
								<ViewDetailsAction text="History" />
							</Link>
						</DropdownMenuItem>
						{row.original.currentStructureId ? (
							<DropdownMenuItem asChild>
								<Link
									to="/app/payroll/salary-structures/structure/$structureId"
									params={{
										structureId: String(row.original.currentStructureId),
									}}
								>
									<ViewDetailsAction />
								</Link>
							</DropdownMenuItem>
						) : null}
					</PermissionGate>
				</DatatableActions>
			),
		},
	];

	if (!data.length && !filters.q) {
		return (
			<EmptyState
				title="No Employees"
				description="Employees will appear here once they are created."
				icon={<CalculatorIcon />}
			/>
		);
	}

	return <DataTable columns={columns} data={data} />;
}
