import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import {
	BanknoteIcon,
	CreditCardIcon,
	FileIcon,
	NotepadTextIcon,
	ReceiptTextIcon,
	SmartphoneIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EditAction } from "@/components/ui/custom-button";
import { DataTable } from "@/components/ui/datatable";
import { DatatableActions } from "@/components/ui/datatable-actions";
import { DeleteActionButton } from "@/components/ui/delete-action";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { PhoneIcon } from "@/components/ui/icons";
import { PermissionGate } from "@/components/ui/permission-gate";
import { Skeleton } from "@/components/ui/skeleton";
import { expenseQueries } from "@/features/expenses/services/queries";
import { useFilters } from "@/hooks/use-filters";
import { currencyFormatter, dateFormat } from "@/lib/helpers";
import { toTitleCase } from "@/lib/utils";

export function ExpenseDatatable() {
	const { filters } = useFilters(getRouteApi("/app/expenses/").id);
	const { data: expenses } = useSuspenseQuery(expenseQueries.list(filters));

	const columns: Array<ColumnDef<(typeof expenses)[0]>> = [
		{
			accessorKey: "expenseDate",
			header: "Date",
			cell: ({ row }) => {
				return <span>{dateFormat(row.original.expenseDate, "long")}</span>;
			},
		},
		{
			accessorKey: "expenseNo",
			header: "Expense No",
		},
		{
			accessorKey: "payee",
			header: "Payee",
			cell: ({ row }) => toTitleCase(row.original.payee),
		},
		{
			accessorKey: "paymentMethod",
			header: "Payment Method",
			cell: ({
				row: {
					original: { paymentMethod },
				},
			}) => (
				<Badge variant="outline" className="uppercase">
					{paymentMethod === "cash" ? (
						<BanknoteIcon />
					) : paymentMethod === "cheque" ? (
						<ReceiptTextIcon />
					) : paymentMethod === "bank" ? (
						<CreditCardIcon />
					) : (
						<SmartphoneIcon />
					)}
					{paymentMethod}
				</Badge>
			),
		},
		{
			accessorKey: "reference",
			header: "Reference",
			cell: ({ row }) => row.original.reference?.toUpperCase() ?? "",
		},
		{
			accessorKey: "expenseAmount",
			header: "Amount",
			cell: ({ row }) => {
				return (
					<Badge variant="danger">
						{currencyFormatter(row.original.expenseAmount)}
					</Badge>
				);
			},
		},
		{
			id: "actions",
			cell: ({
				row: {
					original: { attachmentCount, id },
				},
			}) => (
				<DatatableActions>
					<PermissionGate
						permission="expenses:update"
						loadingComponent={<Skeleton className="h-4 w-56" />}
					>
						<DropdownMenuItem asChild>
							<Link
								to="/app/expenses/$expenseId/edit"
								params={{ expenseId: id }}
							>
								<EditAction />
							</Link>
						</DropdownMenuItem>
					</PermissionGate>
					{attachmentCount > 0 && (
						<DropdownMenuItem>
							<FileIcon className="size-4! text-muted-foreground" />
							<span className="text-xs -ml-1">View Attachment</span>
						</DropdownMenuItem>
					)}
					<DropdownMenuItem>
						<NotepadTextIcon className="size-4! text-muted-foreground" />
						<span className="text-xs -ml-1">Journal Entry</span>
					</DropdownMenuItem>
					<PermissionGate
						permission="expenses:delete"
						loadingComponent={<Skeleton className="h-4 w-56" />}
					>
						<DeleteActionButton
							resourceId={id}
							queryKey={["expenses"]}
							deleteAction={async () => {}}
						/>
					</PermissionGate>
				</DatatableActions>
			),
		},
	];

	return <DataTable data={expenses} columns={columns} />;
}
