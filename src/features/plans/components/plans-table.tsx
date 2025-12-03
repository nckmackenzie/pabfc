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
import {
	CheckCircleIcon,
	DollarSignIcon,
	Users2Icon,
	XCircleIcon,
} from "@/components/ui/icons";
import { PermissionGate } from "@/components/ui/permission-gate";
import { Skeleton } from "@/components/ui/skeleton";
import { useFilters } from "@/hooks/use-filters";
import { currencyFormatter } from "@/lib/helpers";
import { deletePlan } from "../services/plans.api";
import { planQueries } from "../services/queries";

export function PlansTable() {
	const { filters } = useFilters(getRouteApi("/app/plans/").id);
	const { data } = useSuspenseQuery(planQueries.list(filters));
	const columns: Array<ColumnDef<(typeof data)[0]>> = [
		{
			accessorKey: "name",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Plan/Package Name" />
			),
		},
		{
			accessorKey: "duration",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Duration" />
			),
			cell: ({ row }) => `${row.original.duration} days`,
		},
		{
			accessorKey: "price",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Price" />
			),
			cell: ({ row }) => (
				<Badge variant="secondary">
					{currencyFormatter(row.original.price)}
				</Badge>
			),
		},
		{
			accessorKey: "isSessionBased",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Session Based" />
			),
			cell: ({ row }) => (
				<Badge variant="outline">
					{row.original.isSessionBased ? "Yes" : "No"}
				</Badge>
			),
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
							<Link to={`/app/plans/$planId/edit`} params={{ planId: id }}>
								<EditAction />
							</Link>
						</DropdownMenuItem>
					</PermissionGate>
					{/* TODO: IMPLEMENT */}
					<PermissionGate
						permissions={["plans:view"]}
						loadingComponent={<Skeleton className="h-4 w-24" />}
					>
						<DropdownMenuItem disabled>
							<Users2Icon />
							<span className="-ml-1">View Members On Plan</span>
						</DropdownMenuItem>
						<DropdownMenuItem disabled>
							<DollarSignIcon />
							<span className="-ml-1">View Plan Revenue</span>
						</DropdownMenuItem>
					</PermissionGate>
					<PermissionGate
						permissions={["plans:delete"]}
						loadingComponent={<Skeleton className="h-4 w-24" />}
					>
						<DeleteActionButton
							queryKey={["plans"]}
							resourceId={id}
							deleteAction={deletePlan}
							fallbackMessage="Error deleting plan"
						/>
					</PermissionGate>
				</DatatableActions>
			),
		},
	];
	return <DataTable columns={columns} data={data} />;
}
