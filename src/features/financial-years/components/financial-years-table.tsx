import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { EditAction } from "@/components/ui/custom-button";
import { DataTable } from "@/components/ui/datatable";
import { DatatableActions } from "@/components/ui/datatable-actions";
import { DeleteActionButton } from "@/components/ui/delete-action";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { PermissionGate } from "@/components/ui/permission-gate";
import { Skeleton } from "@/components/ui/skeleton";
import { deleteFinancialYear } from "@/features/financial-years/services/financial-years.api";
import { financialYearQueries } from "@/features/financial-years/services/queries";
import { useFilters } from "@/hooks/use-filters";
import { dateFormat } from "@/lib/helpers";
import { toTitleCase } from "@/lib/utils";

export function FinancialYearsTable() {
	const { filters } = useFilters(getRouteApi("/app/financial-years/").id);
	const { data: financialYears } = useSuspenseQuery(
		financialYearQueries.list(filters),
	);

	const columns: Array<ColumnDef<(typeof financialYears)[0]>> = [
		{
			accessorKey: "name",
			header: "Name",
			cell: ({ row: { original } }) => toTitleCase(original.name),
		},
		{
			accessorKey: "startDate",
			header: "Start Date",
			cell: ({ row }) => dateFormat(row.original.startDate, "long"),
		},
		{
			accessorKey: "endDate",
			header: "End Date",
			cell: ({ row }) => dateFormat(row.original.endDate, "long"),
		},
		{
			accessorKey: "closed",
			header: "Status",
			cell: ({ row }) => (
				<Badge variant={row.original.closed ? "warning" : "success"}>
					{row.original.closed ? "Closed" : "Open"}
				</Badge>
			),
		},
		{
			accessorKey: "closedDate",
			header: "Closed Date",
			cell: ({ row }) =>
				row.original.closedDate
					? dateFormat(row.original.closedDate, "long")
					: "-",
		},
		{
			id: "actions",
			cell: ({ row }) => (
				<DatatableActions>
					<PermissionGate
						permission="financial-years:update"
						loadingComponent={<Skeleton className="h-4 w-56" />}
					>
						<DropdownMenuItem asChild>
							<Link
								to="/app/financial-years/$financialYearId/edit"
								params={{ financialYearId: row.original.id }}
							>
								<EditAction />
							</Link>
						</DropdownMenuItem>
					</PermissionGate>
					<PermissionGate
						permission="financial-years:delete"
						loadingComponent={<Skeleton className="h-4 w-56" />}
					>
						<DeleteActionButton
							deleteAction={deleteFinancialYear}
							resourceId={row.original.id}
							queryKey={["financial-years"]}
						/>
					</PermissionGate>
				</DatatableActions>
			),
		},
	];

	return <DataTable columns={columns} data={financialYears} />;
}
