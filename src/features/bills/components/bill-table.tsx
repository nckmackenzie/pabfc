import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { CoinsIcon, CopyIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EditAction } from "@/components/ui/custom-button";
import { CustomDropdownContent } from "@/components/ui/custom-dropdown-content";
import { CustomDropdownTrigger } from "@/components/ui/custom-dropdown-trigger";
import { DataTable } from "@/components/ui/datatable";
import { DeleteActionButton } from "@/components/ui/delete-action";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { PermissionGate } from "@/components/ui/permission-gate";
import { Skeleton } from "@/components/ui/skeleton";
import { deleteBill } from "@/features/bills/services/bills.api";
import { billQueries } from "@/features/bills/services/queries";
import { useFilters } from "@/hooks/use-filters";
import { currencyFormatter, dateFormat } from "@/lib/helpers";
import { toTitleCase } from "@/lib/utils";

export function BillTable() {
	const { id } = getRouteApi("/app/bills/");
	const { filters } = useFilters(id);
	const { data } = useSuspenseQuery(billQueries.list(filters));

	const columns: Array<ColumnDef<(typeof data)[0]>> = [
		{
			accessorKey: "invoiceNo",
			header: "Invoice No",
		},
		{
			accessorKey: "invoiceDate",
			header: "Invoice Date",
			cell: ({ row }) => dateFormat(row.original.invoiceDate, "long"),
		},
		{
			accessorKey: "dueDate",
			header: "Due Date",
			cell: ({ row }) =>
				row.original.dueDate
					? dateFormat(row.original.dueDate, "long")
					: undefined,
		},
		{
			accessorKey: "name",
			header: "Name",
			cell: ({
				row: {
					original: { name },
				},
			}) => toTitleCase(name),
		},
		{
			accessorKey: "total",
			header: "Amount",
			cell: ({
				row: {
					original: { total },
				},
			}) => <Badge variant="outline">{currencyFormatter(total)}</Badge>,
		},
		{
			accessorKey: "status",
			header: "Status",
			cell: ({
				row: {
					original: { status },
				},
			}) => (
				<Badge
					variant={
						status === "paid"
							? "success"
							: status === "overdue"
								? "destructive"
								: "warning"
					}
				>
					{toTitleCase(status)}
				</Badge>
			),
		},
		{
			id: "actions",
			cell: ({
				row: {
					original: { id, totalPayment, total },
				},
			}) => (
				<DropdownMenu>
					<CustomDropdownTrigger />
					<CustomDropdownContent>
						{+totalPayment === 0 && (
							<PermissionGate
								permission="bills:update"
								loadingComponent={<Skeleton className="h-4 w-56" />}
							>
								<DropdownMenuItem asChild>
									<Link to="/app/bills/$billId/edit" params={{ billId: id }}>
										<EditAction />
									</Link>
								</DropdownMenuItem>
							</PermissionGate>
						)}
						<DropdownMenuItem asChild>
							<Link to="/app/bills/new" search={{ cloneFrom: id }}>
								<CopyIcon />
								<span className="-ml-1">Create Another</span>
							</Link>
						</DropdownMenuItem>
						{+totalPayment < +total && (
							<DropdownMenuItem asChild disabled>
								<Link to="/app/bills/$billId/edit" params={{ billId: id }}>
									<CoinsIcon />
									<span className="-ml-1">Make Payment</span>
								</Link>
							</DropdownMenuItem>
						)}
						{+totalPayment === 0 && (
							<PermissionGate
								permission="bills:delete"
								loadingComponent={<Skeleton className="h-4 w-56" />}
							>
								<DeleteActionButton
									resourceId={id}
									queryKey={["bills"]}
									deleteAction={deleteBill}
									successMessage="Bill deleted successfully!"
								/>
							</PermissionGate>
						)}
					</CustomDropdownContent>
				</DropdownMenu>
			),
		},
	];

	return <DataTable data={data} columns={columns} />;
}
