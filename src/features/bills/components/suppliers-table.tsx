import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { EditAction } from "@/components/ui/custom-button";
import { CustomDropdownContent } from "@/components/ui/custom-dropdown-content";
import { CustomDropdownTrigger } from "@/components/ui/custom-dropdown-trigger";
import { DataTable } from "@/components/ui/datatable";
import { DataTableColumnHeader } from "@/components/ui/datatable-column-header";
import { DeleteActionButton } from "@/components/ui/delete-action";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty";
import { Users2Icon } from "@/components/ui/icons";
import type { vendors } from "@/drizzle/schema";
import { supplierQueries } from "@/features/bills/services/queries";
import { deleteSupplier } from "@/features/bills/services/suppliers.api";
import { useFilters } from "@/hooks/use-filters";
import { toTitleCase } from "@/lib/utils";

export function SuppliersTable() {
	const { filters } = useFilters(getRouteApi("/app/suppliers/").id);
	const { data } = useSuspenseQuery(supplierQueries.list(filters));
	const columns: Array<ColumnDef<typeof vendors.$inferSelect>> = [
		{
			accessorKey: "name",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Name" />
			),
			cell: ({ row }) => toTitleCase(row.original.name),
		},
		{
			accessorKey: "email",
			header: "Email",
		},
		{
			accessorKey: "phone",
			header: "Phone",
		},
		{
			accessorKey: "address",
			header: "Address",
		},
		{
			accessorKey: "active",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Active" />
			),
			cell: ({ row }) => (
				<Badge variant={row.original.active ? "success" : "danger"}>
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
				<DropdownMenu>
					<CustomDropdownTrigger />
					<CustomDropdownContent>
						<DropdownMenuItem asChild>
							<Link
								to="/app/suppliers/$supplierId/edit"
								params={{ supplierId: id }}
							>
								<EditAction />
							</Link>
						</DropdownMenuItem>
						<DeleteActionButton
							resourceId={id}
							queryKey={["vendors"]}
							deleteAction={deleteSupplier}
							successMessage="Supplier deleted successfully!"
						/>
					</CustomDropdownContent>
				</DropdownMenu>
			),
		},
	];

	if (!data.length && !filters?.q) {
		return (
			<EmptyState
				title="No Suppliers"
				description="There are no suppliers created yet."
				buttonName="Create Supplier"
				path="/app/suppliers/new"
				icon={<Users2Icon />}
			/>
		);
	}

	return <DataTable data={data} columns={columns} />;
}
