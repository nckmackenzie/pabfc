import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { CoinsIcon } from "lucide-react";
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
import { deletePayment } from "@/features/payments/services/payments.api";
import { paymentQueries } from "@/features/payments/services/queries";
import { useFilters } from "@/hooks/use-filters";
import { currencyFormatter, dateFormat } from "@/lib/helpers";
import { toTitleCase } from "@/lib/utils";

export function PaymentsTable() {
	const { filters } = useFilters(getRouteApi("/app/payments/").id);
	const { data } = useSuspenseQuery(paymentQueries.list(filters));
	const columns: Array<ColumnDef<(typeof data)[0]>> = [
		{
			accessorKey: "paymentNo",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Payment No" />
			),
		},
		{
			accessorKey: "vendorName",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Vendor Name" />
			),
			cell: ({ row }) => toTitleCase(row.original.vendorName.toLowerCase()),
		},
		{
			accessorKey: "paymentDate",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Payment Date" />
			),
			cell: ({
				row: {
					original: { paymentDate },
				},
			}) => dateFormat(paymentDate, "long"),
		},
		{
			accessorKey: "paymentMethod",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Payment Method" />
			),
			cell: ({ row }) => toTitleCase(row.original.paymentMethod.toLowerCase()),
		},
		{
			accessorKey: "reference",
			header: "Reference",
			cell: ({ row }) => row.original.reference?.toUpperCase() ?? "",
		},
		{
			accessorKey: "amount",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Amount" />
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
							permission="payments:update"
							loadingComponent={<Skeleton className="h-4 w-56" />}
						>
							<DropdownMenuItem asChild>
								<Link
									to="/app/payments/$paymentId/edit"
									params={{ paymentId: id }}
								>
									<EditAction />
								</Link>
							</DropdownMenuItem>
						</PermissionGate>
						<PermissionGate
							permission="payments:view"
							loadingComponent={<Skeleton className="h-4 w-56" />}
						>
							<DropdownMenuItem asChild>
								<Link
									to="/app/payments/$paymentId/details"
									params={{ paymentId: id }}
								>
									<ViewDetailsAction text="View" />
								</Link>
							</DropdownMenuItem>
						</PermissionGate>
						<PermissionGate
							permission="payments:delete"
							loadingComponent={<Skeleton className="h-4 w-56" />}
						>
							<DeleteActionButton
								resourceId={id}
								queryKey={["payments"]}
								deleteAction={deletePayment}
								successMessage="Payment deleted successfully!"
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
				title="No Payments"
				description="You haven't created any payments yet."
				buttonName="Create your first payment"
				icon={<CoinsIcon />}
				path="/app/payments/new"
			/>
		);
	}

	return <DataTable data={data} columns={columns} />;
}
