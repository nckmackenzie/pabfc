import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { ViewDetailsAction } from "@/components/ui/custom-button";
import { DataTable } from "@/components/ui/datatable";
import { DatatableActions } from "@/components/ui/datatable-actions";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { CheckIcon, LoaderIcon, ResetIcon, XIcon } from "@/components/ui/icons";
import { PermissionGate } from "@/components/ui/permission-gate";
import { Skeleton } from "@/components/ui/skeleton";
import { MemberAvatar } from "@/features/members/components/member-table";
import { VoidPaymentModal } from "@/features/receipts/components/void-payment-modal";
import { paymentsQueries } from "@/features/receipts/services/queries";
import { useFilters } from "@/hooks/use-filters";
import { useModal } from "@/integrations/modal-provider";
import { currencyFormatter, dateFormat } from "@/lib/helpers";
import { toTitleCase } from "@/lib/utils";

export function ReceiptsTable() {
	const { filters } = useFilters(getRouteApi("/app/receipts/").id);
	const { data: payments } = useSuspenseQuery(paymentsQueries.list(filters));

	const columns: Array<ColumnDef<(typeof payments)[0]>> = [
		{
			accessorKey: "paymentDate",
			header: "Payment Date",
			cell: ({ row }) => dateFormat(row.original.paymentDate, "long"),
		},
		{
			accessorKey: "memberName",
			header: "Member",
			cell: ({
				row: {
					original: { memberName, image, memberCount },
				},
			}) => {
				return (
					<div className="flex items-center gap-2">
						<MemberAvatar memberName={memberName} image={image} />
						<span>{toTitleCase(`${memberName}`)}</span>
						{memberCount > 1 && <Badge variant="outline">+{memberCount - 1}</Badge>}
					</div>
				);
			},
		},
		{
			accessorKey: "paymentNo",
			header: "Payment No",
			cell: ({ row }) => row.original.paymentNo,
		},
		{
			accessorKey: "plan",
			header: "Membership Plan",
			cell: ({ row }) =>
				row.original.type === "addon" ? (
					<Badge variant="secondary">Addon only</Badge>
				) : (
					toTitleCase(row.original.plan ?? "")
				),
		},
		{
			accessorKey: "reference",
			header: "Reference",
			cell: ({ row }) => row.original.reference?.toUpperCase(),
		},
		{
			accessorKey: "amount",
			header: "Amount",
			cell: ({ row }) => <Badge variant="outline">{currencyFormatter(row.original.amount)}</Badge>,
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
						status === "completed"
							? "success"
							: status === "pending"
								? "info"
								: status === "refunded"
									? "warning"
									: status === "voided"
										? "destructive"
										: "secondary"
					}
					className="capitalize"
				>
					{status === "completed" ? (
						<CheckIcon />
					) : status === "refunded" ? (
						<ResetIcon />
					) : status === "pending" ? (
						<LoaderIcon className="animate-spin" />
					) : (
						<XIcon />
					)}
					<span>{status}</span>
				</Badge>
			),
		},
		{
			id: "actions",
			cell: ({ row }) => (
				<DatatableActions>
					<DropdownMenuItem asChild>
						{row.original.type === "addon" ? (
							<Link
								to="/app/receipts/addons/$addonInvoiceId/details"
								params={{ addonInvoiceId: row.original.id }}
							>
								<ViewDetailsAction />
							</Link>
						) : (
							<Link to="/app/receipts/$receiptId/details" params={{ receiptId: row.original.id }}>
								<ViewDetailsAction />
							</Link>
						)}
					</DropdownMenuItem>
					{row.original.status === "completed" && row.original.type !== "addon" && (
						<PermissionGate
							permission="receipts:void"
							loadingComponent={<Skeleton className="h-4 w-32" />}
						>
							<VoidReceiptMenuItem paymentId={row.original.id} />
						</PermissionGate>
					)}
				</DatatableActions>
			),
		},
	];

	return <DataTable columns={columns} data={payments} />;
}

function VoidReceiptMenuItem({ paymentId }: { paymentId: string }) {
	const { setOpen } = useModal();

	return (
		<DropdownMenuItem
			onSelect={() => setOpen(<VoidPaymentModal paymentId={paymentId} />)}
			className="text-destructive"
		>
			<XIcon className="size-4" />
			<span className="-ml-1">Void</span>
		</DropdownMenuItem>
	);
}
