import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/datatable";
import { TableCell } from "@/components/ui/table";
import { getPaymentsReport } from "@/features/reports/services/payments-report.api";
import type { PaymentsReportFormSchema } from "@/features/reports/services/schema";
import { useFilters } from "@/hooks/use-filters";
import { currencyFormatter, dateFormat, toNumber } from "@/lib/helpers";
import { toTitleCase } from "@/lib/utils";

type PaymentsReportData = Awaited<ReturnType<typeof getPaymentsReport>>[number];

const columns: Array<ColumnDef<PaymentsReportData>> = [
	{
		accessorKey: "paymentDate",
		header: "Payment Date",
		cell: ({ row }) => dateFormat(row.original.paymentDate, "reporting"),
	},
	{
		accessorKey: "paymentNo",
		header: "Payment No",
	},
	{
		accessorKey: "vendor",
		header: "Vendor",
		cell: ({ row }) => toTitleCase(row.original.vendor),
	},
	{
		accessorKey: "amount",
		header: () => <div className="text-right">Amount</div>,
		cell: ({ row }) => (
			<div className="text-right">
				{currencyFormatter(row.original.amount, false)}
			</div>
		),
	},
	{
		accessorKey: "paymentMethod",
		header: "Payment Method",
		cell: ({ row }) => toTitleCase(row.original.paymentMethod),
	},
	{
		accessorKey: "reference",
		header: "Reference",
		cell: ({ row }) => (
			<div>{row.original.reference ? row.original.reference : "-"}</div>
		),
	},
];

export function PaymentsReportDataTable() {
	const { filters } = useFilters(
		getRouteApi("/app/reports/finance/payments/").id,
	);
	const { data } = useSuspenseQuery({
		queryKey: ["reports", "payments", filters],
		queryFn: () =>
			getPaymentsReport({
				data: filters as PaymentsReportFormSchema,
			}),
	});

	const totalAmount = data.reduce((acc, row) => acc + toNumber(row.amount), 0);

	return (
		<DataTable
			columns={columns}
			data={data}
			exportToExcel
			customFooter={
				<>
					<TableCell colSpan={3} className="font-semibold text-center">
						Totals:
					</TableCell>
					<TableCell className="font-semibold text-right">
						{currencyFormatter(totalAmount, false)}
					</TableCell>
					<TableCell colSpan={2} />
				</>
			}
		/>
	);
}
