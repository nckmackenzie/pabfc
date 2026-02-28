import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/datatable";
import { TableCell } from "@/components/ui/table";
import { getReceiptReport } from "@/features/reports/services/receipt-report.api";
import type { ReceiptValidateSchema } from "@/features/reports/services/schema";
import { useFilters } from "@/hooks/use-filters";
import { currencyFormatter, dateFormat } from "@/lib/helpers";

type ReceiptReportData = Awaited<ReturnType<typeof getReceiptReport>>[number];
const columns: Array<ColumnDef<ReceiptReportData>> = [
	{
		accessorKey: "paymentDate",
		header: "Payment Date",
		cell: ({ row }) => dateFormat(row.original.paymentDate, "regular"),
	},
	{
		accessorKey: "fullName",
		header: "Member",
		cell: ({ row }) => row.original.fullName.toUpperCase(),
	},
	{
		accessorKey: "reference",
		header: "Reference",
		cell: ({ row }) => row.original.reference?.toUpperCase(),
	},
	{
		accessorKey: "paymentMethod",
		header: "Payment Method",
		cell: ({ row }) => row.original.paymentMethod.toUpperCase(),
	},
	{
		accessorKey: "amount",
		header: () => <div className="text-right">Amount</div>,
		cell: ({ row }) => (
			<div className="text-right">{row.original.amount.toLocaleString()}</div>
		),
	},
	{
		accessorKey: "discount",
		header: () => <div className="text-right">Discount</div>,
		cell: ({ row }) => (
			<div className="text-right">{row.original.discount.toLocaleString()}</div>
		),
	},
	{
		accessorKey: "taxAmount",
		header: () => <div className="text-right">Tax Amount</div>,
		cell: ({ row }) => (
			<div className="text-right">
				{row.original.taxAmount.toLocaleString()}
			</div>
		),
	},
	{
		accessorKey: "totalAmount",
		header: () => <div className="text-right">Total Amount</div>,
		cell: ({ row }) => (
			<div className="text-right">
				{row.original.totalAmount.toLocaleString()}
			</div>
		),
	},
];

export function ReceiptReportDataTable() {
	const { filters } = useFilters(
		getRouteApi("/app/reports/finance/receipts/").id,
	);
	const { data } = useSuspenseQuery({
		queryKey: ["payments", filters],
		queryFn: () => getReceiptReport({ data: filters as ReceiptValidateSchema }),
	});

	const { amount, discount, taxAmount, totalAmount } = data.reduce(
		(acc, payment) => {
			acc.amount += parseFloat(payment.amount);
			acc.discount += parseFloat(payment.discount);
			acc.taxAmount += parseFloat(payment.taxAmount);
			acc.totalAmount += parseFloat(payment.totalAmount);
			return acc;
		},
		{ amount: 0, discount: 0, taxAmount: 0, totalAmount: 0 },
	);

	return (
		<DataTable
			customFooter={
				<>
					<TableCell colSpan={4} className="font-semibold text-center">
						Totals:
					</TableCell>
					<TableCell className="font-semibold text-right">
						{currencyFormatter(amount, false)}
					</TableCell>
					<TableCell className="font-semibold text-right">
						{currencyFormatter(discount, false)}
					</TableCell>
					<TableCell className="font-semibold text-right">
						{currencyFormatter(taxAmount, false)}
					</TableCell>
					<TableCell className="font-semibold text-right">
						{currencyFormatter(totalAmount, false)}
					</TableCell>
				</>
			}
			columns={columns}
			data={data}
			exportToExcel
		/>
	);
}
