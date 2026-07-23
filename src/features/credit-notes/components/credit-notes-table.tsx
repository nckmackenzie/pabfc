import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { ViewDetailsAction } from "@/components/ui/custom-button";
import { DataTable } from "@/components/ui/datatable";
import { DatatableActions } from "@/components/ui/datatable-actions";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { creditNoteQueries } from "@/features/credit-notes/services/queries";
import { useFilters } from "@/hooks/use-filters";
import { currencyFormatter, dateFormat } from "@/lib/helpers";
import { toTitleCase } from "@/lib/utils";

const STATUS_VARIANT = {
	active: "success",
	partially_redeemed: "info",
	fully_redeemed: "secondary",
	expired: "destructive",
} as const;

export function CreditNotesTable() {
	const { filters } = useFilters(getRouteApi("/app/credit-notes/").id);
	const { data: creditNotes } = useSuspenseQuery(creditNoteQueries.list(filters));

	const columns: Array<ColumnDef<(typeof creditNotes)[0]>> = [
		{
			accessorKey: "creditNoteNo",
			header: "Credit Note No",
		},
		{
			accessorKey: "memberName",
			header: "Member",
			cell: ({ row }) => toTitleCase(row.original.memberName),
		},
		{
			accessorKey: "amount",
			header: "Amount",
			cell: ({ row }) => currencyFormatter(row.original.amount),
		},
		{
			accessorKey: "balanceRemaining",
			header: "Balance Remaining",
			cell: ({ row }) => currencyFormatter(row.original.balanceRemaining),
		},
		{
			accessorKey: "status",
			header: "Status",
			cell: ({ row }) => (
				<Badge variant={STATUS_VARIANT[row.original.status]} className="capitalize">
					{row.original.status.replace(/_/g, " ")}
				</Badge>
			),
		},
		{
			accessorKey: "expiresAt",
			header: "Expires",
			cell: ({ row }) => dateFormat(row.original.expiresAt, "long"),
		},
		{
			id: "actions",
			cell: ({ row }) => (
				<DatatableActions>
					<DropdownMenuItem asChild>
						<Link
							to="/app/credit-notes/$creditNoteId/details"
							params={{ creditNoteId: row.original.id }}
						>
							<ViewDetailsAction />
						</Link>
					</DropdownMenuItem>
				</DatatableActions>
			),
		},
	];

	return <DataTable columns={columns} data={creditNotes} />;
}
