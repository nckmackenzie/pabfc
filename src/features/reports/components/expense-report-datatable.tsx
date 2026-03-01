import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/datatable";
import { TableCell } from "@/components/ui/table";
import { getExpenseReport } from "@/features/reports/services/expense-report.api";
import type { ExpenseValidateSchema } from "@/features/reports/services/schema";
import { useFilters } from "@/hooks/use-filters";
import { currencyFormatter, dateFormat } from "@/lib/helpers";
import { toTitleCase } from "@/lib/utils";

type ExpenseReportData = Awaited<ReturnType<typeof getExpenseReport>>[number];

const columns: Array<ColumnDef<ExpenseReportData>> = [
	{
		accessorKey: "expenseDate",
		header: "Date",
		cell: ({ row }) => dateFormat(row.original.expenseDate, "reporting"),
	},
	{
		accessorKey: "payee",
		header: "Payee",
		cell: ({ row }) => toTitleCase(row.original.payee),
	},
	{
		accessorKey: "expenseNo",
		header: "Expense No",
	},
	{
		accessorKey: "expenseAccount",
		header: "Expense Account",
		cell: ({ row }) => toTitleCase(row.original.expenseAccount),
	},
	{
		accessorKey: "amount",
		header: () => <div className="text-right">Amount</div>,
		cell: ({ row }) => (
			<Link
				to="/app/expenses/$expenseId/view"
				params={{ expenseId: row.original.id }}
				className="text-right block hover:underline text-blue-600"
			>
				{currencyFormatter(row.original.amount, false)}
			</Link>
		),
	},
	{
		accessorKey: "paymentMethod",
		header: "Payment Method",
		cell: ({ row }) => row.original.paymentMethod.toUpperCase(),
	},
];

export function ExpenseReportDataTable() {
	const { filters } = useFilters(
		getRouteApi("/app/reports/finance/expenses/").id,
	);
	const { data } = useSuspenseQuery({
		queryKey: ["reports", "expenses", filters],
		queryFn: () => getExpenseReport({ data: filters as ExpenseValidateSchema }),
	});

	const totalAmount = data.reduce(
		(acc, expense) => acc + Number.parseFloat(expense.amount),
		0,
	);

	return (
		<DataTable
			customFooter={
				<>
					<TableCell colSpan={4} className="font-semibold text-center">
						Totals:
					</TableCell>
					<TableCell className="font-semibold text-right">
						{currencyFormatter(totalAmount, false)}
					</TableCell>
					<TableCell />
				</>
			}
			columns={columns}
			data={data}
			exportToExcel
		/>
	);
}
