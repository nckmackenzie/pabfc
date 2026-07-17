import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { EditAction } from "@/components/ui/custom-button";
import { DataTable } from "@/components/ui/datatable";
import { DatatableActions } from "@/components/ui/datatable-actions";
import { DataTableColumnHeader } from "@/components/ui/datatable-column-header";
import { DeleteActionButton } from "@/components/ui/delete-action";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { CheckCircleIcon, XCircleIcon } from "@/components/ui/icons";
import { PermissionGate } from "@/components/ui/permission-gate";
import { Skeleton } from "@/components/ui/skeleton";
import { deleteAddon } from "@/features/addons/services/addons.api";
import { addonQueries } from "@/features/addons/services/queries";
import { currencyFormatter } from "@/lib/helpers";

export function AddonsTable() {
	const { data } = useSuspenseQuery(addonQueries.list());
	const columns: Array<ColumnDef<(typeof data)[0]>> = [
		{
			accessorKey: "name",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Addon Name" />
			),
		},
		{
			accessorKey: "amount",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Rate / period" />
			),
			cell: ({ row }) => (
				<Badge variant="secondary">
					{currencyFormatter(row.original.amount)}
				</Badge>
			),
		},
		{
			accessorKey: "perMember",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Per Member" />
			),
			cell: ({ row }) => (
				<Badge variant="outline">
					{row.original.perMember ? "Yes" : "No"}
				</Badge>
			),
		},
		{
			accessorKey: "revenueAccountName",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Revenue Account" />
			),
			cell: ({ row }) => row.original.revenueAccountName ?? "—",
		},
		{
			accessorKey: "active",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Status" />
			),
			cell: ({ row }) => (
				<Badge variant={row.original.active ? "success" : "danger"}>
					{row.original.active ? (
						<CheckCircleIcon className="size-4!" />
					) : (
						<XCircleIcon className="size-4!" />
					)}
					{row.original.active ? "Active" : "Inactive"}
				</Badge>
			),
		},
		{
			id: "actions",
			cell: ({
				row: {
					original: { id },
				},
			}) => (
				<DatatableActions>
					<PermissionGate
						permissions={["plans:update"]}
						loadingComponent={<Skeleton className="h-4 w-24" />}
					>
						<DropdownMenuItem asChild>
							<Link to="/app/plans/addons/$addonId/edit" params={{ addonId: id }}>
								<EditAction />
							</Link>
						</DropdownMenuItem>
					</PermissionGate>
					<PermissionGate
						permissions={["plans:delete"]}
						loadingComponent={<Skeleton className="h-4 w-24" />}
					>
						<DeleteActionButton
							queryKey={["addons"]}
							resourceId={id}
							deleteAction={deleteAddon}
							fallbackMessage="Error deleting addon"
						/>
					</PermissionGate>
				</DatatableActions>
			),
		},
	];
	return <DataTable columns={columns} data={data} />;
}
