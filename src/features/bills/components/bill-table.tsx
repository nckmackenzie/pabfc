import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { CoinsIcon, CopyIcon, ReceiptTextIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EditAction } from "@/components/ui/custom-button";
import { CustomDropdownContent } from "@/components/ui/custom-dropdown-content";
import { CustomDropdownTrigger } from "@/components/ui/custom-dropdown-trigger";
import { DataTable } from "@/components/ui/datatable";
import { DeleteActionButton } from "@/components/ui/delete-action";
import CustomModal from "@/components/ui/custom-modal";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { PermissionGate } from "@/components/ui/permission-gate";
import { Skeleton } from "@/components/ui/skeleton";
import { WhtCertificateForm } from "@/features/bills/components/wht-certificate-form";
import { deleteBill } from "@/features/bills/services/bills.api";
import { billQueries } from "@/features/bills/services/queries";
import { useFilters } from "@/hooks/use-filters";
import { useModal } from "@/integrations/modal-provider";
import { currencyFormatter, dateFormat, toNumber } from "@/lib/helpers";
import { toTitleCase } from "@/lib/utils";

export function BillTable() {
	const { id } = getRouteApi("/app/bills/");
	const { filters } = useFilters(id);
	const { data } = useSuspenseQuery(billQueries.list(filters));
	const { setOpen } = useModal();

	const handleRecordCertificate = (billId: string, invoiceNo: string) => {
		setOpen(
			<CustomModal
				title={`WHT Certificate — Bill ${invoiceNo}`}
				subtitle="Record the certificate issued by iTax for the tax withheld on this bill."
			>
				<WhtCertificateForm billId={billId} />
			</CustomModal>
		);
	};

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
		// `balance` is net of withholding, so it no longer equals total - payments.
		// Showing the withheld amount and the net payable explains that gap as tax
		// rather than leaving it looking like a discrepancy.
		{
			accessorKey: "whtAmount",
			header: "WHT Withheld",
			cell: ({
				row: {
					original: { whtAmount },
				},
			}) =>
				toNumber(whtAmount) > 0 ? (
					<Badge variant="warning">{currencyFormatter(whtAmount)}</Badge>
				) : (
					<span className="text-muted-foreground">—</span>
				),
		},
		{
			accessorKey: "netPayable",
			header: "Net Payable",
			cell: ({
				row: {
					original: { netPayable },
				},
			}) => currencyFormatter(netPayable),
		},
		{
			accessorKey: "displayStatus",
			header: "Status",
			cell: ({
				row: {
					original: { displayStatus },
				},
			}) => (
				<Badge
					variant={
						displayStatus === "paid"
							? "success"
							: displayStatus === "overdue"
								? "destructive"
								: "warning"
					}
				>
					{toTitleCase(displayStatus)}
				</Badge>
			),
		},
		{
			id: "actions",
			cell: ({
				row: {
					original: {
						id,
						totalPayment,
						balance,
						whtAmount,
						whtRemitted,
						invoiceNo,
					},
				},
			}) => (
				<DropdownMenu>
					<CustomDropdownTrigger />
					<CustomDropdownContent>
						{+totalPayment === 0 && toNumber(whtRemitted) === 0 && (
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
						{/* Net of withholding: a bill whose only outstanding amount is the
						    withheld tax has already settled the vendor in full. */}
						{toNumber(balance) > 0 && (
							<DropdownMenuItem asChild>
								<Link to="/app/payments/new" search={{ billId: id }}>
									<CoinsIcon />
									<span className="-ml-1">Make Payment</span>
								</Link>
							</DropdownMenuItem>
						)}
						{toNumber(whtAmount) > 0 && (
							<PermissionGate
								permission="bills:update"
								loadingComponent={<Skeleton className="h-4 w-56" />}
							>
								<DropdownMenuItem
									onClick={() => handleRecordCertificate(id, invoiceNo)}
								>
									<ReceiptTextIcon />
									<span className="-ml-1">WHT Certificate</span>
								</DropdownMenuItem>
							</PermissionGate>
						)}
						{+totalPayment === 0 && toNumber(whtRemitted) === 0 && (
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
