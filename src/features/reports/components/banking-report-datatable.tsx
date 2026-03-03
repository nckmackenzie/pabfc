import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/datatable";
import { TableCell } from "@/components/ui/table";
import { getBankingReport } from "@/features/reports/services/banking-report.api";
import type { BankingValidateSchema } from "@/features/reports/services/schema";
import { useFilters } from "@/hooks/use-filters";
import { currencyFormatter, dateFormat, toNumber } from "@/lib/helpers";
import { toTitleCase } from "@/lib/utils";

type BankingReportData = Awaited<ReturnType<typeof getBankingReport>>[number];

const columns: Array<ColumnDef<BankingReportData>> = [
	{
		accessorKey: "transactionDate",
		header: "Transaction Date",
		cell: ({ row }) => dateFormat(row.original.transactionDate, "reporting"),
	},
	{
		accessorKey: "amount",
		header: () => <div className="text-right">Amount</div>,
		cell: ({ row }) => (
			<div className="text-right">
				{currencyFormatter(toNumber(row.original.amount), false)}
			</div>
		),
	},
	{
		accessorKey: "reference",
		header: "Reference",
		cell: ({ row }) => row.original.reference?.toUpperCase(),
	},
	{
		accessorKey: "description",
		header: "Description",
		cell: ({ row }) => toTitleCase(row.original?.description ?? ""),
	},
	{
		accessorKey: "status",
		header: "Status",
		cell: ({ row }) =>
			row.original.status === "cleared" ? "Cleared" : "Uncleared",
	},
	{
		accessorKey: "clearDate",
		header: "Clear Date",
		cell: ({ row }) =>
			row.original.clearDate
				? dateFormat(row.original.clearDate, "reporting")
				: "-",
	},
];

export function BankingReportDataTable() {
	const { filters } = useFilters(
		getRouteApi("/app/reports/finance/banking/").id,
	);
	const { data } = useSuspenseQuery({
		queryKey: ["reports", "banking", filters],
		queryFn: () => getBankingReport({ data: filters as BankingValidateSchema }),
	});

	const netAmount = data.reduce((acc, row) => acc + toNumber(row.amount), 0);

	return (
		<DataTable
			customFooter={
				<>
					<TableCell className="font-semibold text-center">Totals:</TableCell>
					<TableCell className="font-semibold text-right">
						{currencyFormatter(netAmount, false)}
					</TableCell>
					<TableCell colSpan={4} />
				</>
			}
			columns={columns}
			data={data}
			exportToExcel
		/>
	);
}
