import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { LandmarkIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EditAction, ViewDetailsAction } from "@/components/ui/custom-button";
import { CustomDropdownContent } from "@/components/ui/custom-dropdown-content";
import { CustomDropdownTrigger } from "@/components/ui/custom-dropdown-trigger";
import { DataTable } from "@/components/ui/datatable";
import { DataTableColumnHeader } from "@/components/ui/datatable-column-header";
import { DeleteActionButton } from "@/components/ui/delete-action";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty";
import { PermissionGate } from "@/components/ui/permission-gate";
import { Skeleton } from "@/components/ui/skeleton";
import { remittanceQueries } from "@/features/wht-remittances/services/queries";
import { deleteRemittance } from "@/features/wht-remittances/services/wht-remittances.api";
import { useFilters } from "@/hooks/use-filters";
import { currencyFormatter, dateFormat } from "@/lib/helpers";
import { toTitleCase } from "@/lib/utils";

export function RemittancesTable() {
	const { filters } = useFilters(getRouteApi("/app/wht-remittances/").id);
	const { data } = useSuspenseQuery(remittanceQueries.list(filters));

	const columns: Array<ColumnDef<(typeof data)[0]>> = [
		{
			accessorKey: "remittanceNo",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Remittance No" />
			),
		},
		{
			accessorKey: "remittanceDate",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Remittance Date" />
			),
			cell: ({
				row: {
					original: { remittanceDate },
				},
			}) => dateFormat(remittanceDate, "long"),
		},
		{
			accessorKey: "reference",
			header: "Reference",
			cell: ({ row }) => row.original.reference?.toUpperCase() ?? "",
		},
		{
			accessorKey: "memo",
			header: "Description",
			cell: ({ row }) =>
				row.original.memo ? toTitleCase(row.original.memo) : "",
		},
		{
			accessorKey: "amount",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Amount Remitted" />
			),
			cell: ({
				row: {
					original: { amount },
				},
			}) => <Badge variant="outline">{currencyFormatter(amount ?? 0)}</Badge>,
		},
		{
			id: "action",
			cell: ({
				row: {
					original: { id },
				},
			}) => (
				<DropdownMenu>
					<CustomDropdownTrigger />
					<CustomDropdownContent>
						<PermissionGate
							permission="wht-remittances:update"
							loadingComponent={<Skeleton className="h-4 w-56" />}
						>
							<DropdownMenuItem asChild>
								<Link
									to="/app/wht-remittances/$remittanceId/edit"
									params={{ remittanceId: id }}
								>
									<EditAction />
								</Link>
							</DropdownMenuItem>
						</PermissionGate>
						<PermissionGate
							permission="wht-remittances:view"
							loadingComponent={<Skeleton className="h-4 w-56" />}
						>
							<DropdownMenuItem asChild>
								<Link
									to="/app/wht-remittances/$remittanceId/details"
									params={{ remittanceId: id }}
								>
									<ViewDetailsAction text="View" />
								</Link>
							</DropdownMenuItem>
						</PermissionGate>
						<PermissionGate
							permission="wht-remittances:delete"
							loadingComponent={<Skeleton className="h-4 w-56" />}
						>
							<DeleteActionButton
								resourceId={id}
								queryKey={["wht-remittances"]}
								deleteAction={deleteRemittance}
								successMessage="WHT remittance deleted successfully!"
							/>
						</PermissionGate>
					</CustomDropdownContent>
				</DropdownMenu>
			),
		},
	];

	if (!data.length && !filters.q) {
		return (
			<EmptyState
				title="No WHT Remittances"
				description="You haven't remitted any withholding tax yet."
				buttonName="Create your first remittance"
				icon={<LandmarkIcon />}
				path="/app/wht-remittances/new"
			/>
		);
	}

	return <DataTable data={data} columns={columns} />;
}
