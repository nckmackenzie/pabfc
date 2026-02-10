import {
	useQuery,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { ViewDetailsAction } from "@/components/ui/custom-button";
import { DataTable } from "@/components/ui/datatable";
import { DatatableActions } from "@/components/ui/datatable-actions";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { CheckIcon, LoaderIcon, ResetIcon, XIcon } from "@/components/ui/icons";
import { MemberAvatar } from "@/features/members/components/member-table";
import { paymentsQueries } from "@/features/receipts/services/queries";
import { useFilters } from "@/hooks/use-filters";
import { dateFormat } from "@/lib/helpers";
import { toTitleCase } from "@/lib/utils";

export function ReceiptsTable() {
	const { filters, setFilters } = useFilters(getRouteApi("/app/receipts/").id);
	const queryClient = useQueryClient();
	const { data: payments } = useSuspenseQuery(paymentsQueries.list(filters));
	const { data: freshPayments } = useQuery({
		...paymentsQueries.list(filters),
		enabled: !!filters.payment,
		refetchInterval: 2000,
	});

	useEffect(() => {
		if (freshPayments && filters.payment) {
			const payment = freshPayments.find(
				(payment) => payment.id === filters.payment,
			);
			if (payment?.status === "completed") {
				queryClient.invalidateQueries({ queryKey: ["payments"] });
				setFilters({ payment: undefined });
			}
		}
	}, [freshPayments, filters.payment, setFilters, queryClient]);

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
					original: { memberName, image },
				},
			}) => {
				return (
					<div className="flex items-center gap-2">
						<MemberAvatar memberName={memberName} image={image} />
						<span>{toTitleCase(`${memberName}`)}</span>
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
			cell: ({ row }) => toTitleCase(row.original.plan ?? ""),
		},
		{
			accessorKey: "reference",
			header: "Reference",
			cell: ({ row }) => row.original.reference,
		},
		{
			accessorKey: "amount",
			header: "Amount",
			cell: ({ row }) => row.original.amount,
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
									: "destructive"
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
						<Link
							to="/app/receipts/$receiptId/details"
							params={{ receiptId: row.original.id }}
						>
							<ViewDetailsAction />
						</Link>
					</DropdownMenuItem>
				</DatatableActions>
			),
		},
	];

	return <DataTable columns={columns} data={payments} />;
}
