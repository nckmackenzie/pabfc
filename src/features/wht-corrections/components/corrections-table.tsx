import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { FileWarningIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ViewDetailsAction } from "@/components/ui/custom-button";
import { CustomDropdownContent } from "@/components/ui/custom-dropdown-content";
import { CustomDropdownTrigger } from "@/components/ui/custom-dropdown-trigger";
import { DataTable } from "@/components/ui/datatable";
import { DataTableColumnHeader } from "@/components/ui/datatable-column-header";
import { DeleteActionButton } from "@/components/ui/delete-action";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty";
import { PermissionGate } from "@/components/ui/permission-gate";
import { Skeleton } from "@/components/ui/skeleton";
import { correctionQueries } from "@/features/wht-corrections/services/queries";
import { deleteCorrection } from "@/features/wht-corrections/services/wht-corrections.api";
import { useFilters } from "@/hooks/use-filters";
import { currencyFormatter, dateFormat } from "@/lib/helpers";
import { toTitleCase } from "@/lib/utils";

const STATUS_LABEL = {
	already_remitted: "Already remitted",
	pending: "Pending remittance",
} as const;

export function CorrectionsTable() {
	const { filters } = useFilters(getRouteApi("/app/wht-corrections/").id);
	const { data } = useSuspenseQuery(correctionQueries.list(filters));

	const columns: Array<ColumnDef<(typeof data)[0]>> = [
		{
			accessorKey: "correctionNo",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Correction No" />
			),
		},
		{
			accessorKey: "correctionDate",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Correction Date" />
			),
			cell: ({ row }) => dateFormat(row.original.correctionDate, "long"),
		},
		{
			accessorKey: "remittanceStatus",
			header: "Status",
			cell: ({ row }) => (
				<Badge
					variant={
						row.original.remittanceStatus === "pending" ? "outline" : "secondary"
					}
				>
					{STATUS_LABEL[row.original.remittanceStatus]}
				</Badge>
			),
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
				<DataTableColumnHeader column={column} title="Amount" />
			),
			cell: ({ row }) => (
				<Badge variant="outline">
					{currencyFormatter(row.original.amount ?? 0)}
				</Badge>
			),
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
							permission="wht-corrections:view"
							loadingComponent={<Skeleton className="h-4 w-56" />}
						>
							<DropdownMenuItem asChild>
								<Link
									to="/app/wht-corrections/$correctionId/details"
									params={{ correctionId: id }}
								>
									<ViewDetailsAction text="View" />
								</Link>
							</DropdownMenuItem>
						</PermissionGate>
						<PermissionGate
							permission="wht-corrections:delete"
							loadingComponent={<Skeleton className="h-4 w-56" />}
						>
							<DeleteActionButton
								resourceId={id}
								queryKey={["wht-corrections"]}
								deleteAction={deleteCorrection}
								successMessage="WHT correction deleted successfully!"
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
				title="No WHT Corrections"
				description="You haven't recorded any missed-WHT catch-ups yet."
				buttonName="Create your first correction"
				icon={<FileWarningIcon />}
				path="/app/wht-corrections/new"
			/>
		);
	}

	return <DataTable data={data} columns={columns} />;
}
