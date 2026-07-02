import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { EyeIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/datatable";
import { TableCell } from "@/components/ui/table";
import { formatText } from "@/features/employees/utils/helpers";
import { LoanStatementSheet } from "@/features/reports/components/loan-statement-sheet";
import { getLoanSummaryReport } from "@/features/reports/services/loan-ledger-report.api";
import { getLoanStatusVariant } from "@/features/payroll/lib/loan-options";
import { useFilters } from "@/hooks/use-filters";
import { useSheet } from "@/integrations/sheet-provider";
import { currencyFormatter, dateFormat } from "@/lib/helpers";

const route = getRouteApi("/app/reports/payroll/loans/");
const fmtCur = (value: number) => currencyFormatter(value, false);

export function PayrollLoanLedgerReport() {
	const { filters } = useFilters(route.id);
	const { setOpen } = useSheet();
	const { data } = useSuspenseQuery({
		queryKey: ["reports", "payroll", "loan-ledger", filters],
		queryFn: () =>
			getLoanSummaryReport({
				data: {
					employeeId: filters.employeeId,
					status: filters.status ?? "all",
				},
			}),
		staleTime: 0,
	});

	const columns: Array<ColumnDef<(typeof data.rows)[number]>> = [
		{
			accessorKey: "employeeName",
			header: "Employee Name",
		},
		{
			accessorKey: "loanId",
			header: "Loan ID/Reference",
		},
		{
			accessorKey: "disbursementDate",
			header: "Disbursement Date",
			cell: ({ row }) =>
				row.original.disbursementDate
					? dateFormat(row.original.disbursementDate, "reporting")
					: "-",
		},
		{
			accessorKey: "originalAmount",
			header: () => <div className="text-right">Original Amount (KES)</div>,
			cell: ({ row }) => <div className="text-right">{fmtCur(row.original.originalAmount)}</div>,
		},
		{
			accessorKey: "monthlyInstalment",
			header: () => <div className="text-right">Monthly Instalment (KES)</div>,
			cell: ({ row }) => <div className="text-right">{fmtCur(row.original.monthlyInstalment)}</div>,
		},
		{
			accessorKey: "totalRepaid",
			header: () => <div className="text-right">Total Repaid (KES)</div>,
			cell: ({ row }) => <div className="text-right">{fmtCur(row.original.totalRepaid)}</div>,
		},
		{
			accessorKey: "outstandingBalance",
			header: () => <div className="text-right">Outstanding Balance (KES)</div>,
			cell: ({ row }) => (
				<div className="text-right">{fmtCur(row.original.outstandingBalance)}</div>
			),
		},
		{
			accessorKey: "instalmentsPaid",
			header: () => <div className="text-right">Instalments Paid</div>,
			cell: ({ row }) => <div className="text-right">{row.original.instalmentsPaid}</div>,
		},
		{
			accessorKey: "status",
			header: "Status",
			cell: ({ row }) => (
				<Badge
					variant={getLoanStatusVariant(row.original.status) ?? "secondary"}
					className="capitalize"
				>
					{formatText(row.original.status)}
				</Badge>
			),
		},
		{
			id: "actions",
			header: "Statement",
			cell: ({ row }) => (
				<Button
					variant="outline"
					size="sm"
					onClick={() =>
						setOpen(<LoanStatementSheet loanId={row.original.loanId} />, {
							className: "max-w-6xl!",
							title: "Loan Statement",
							description: `Repayment statement for ${row.original.employeeName}.`,
						})
					}
				>
					<EyeIcon />
					View Statement
				</Button>
			),
		},
	];

	return (
		<DataTable
			data={data.rows}
			columns={columns}
			exportToExcel
			customFooter={
				<>
					<TableCell colSpan={3} className="font-semibold">
						Totals
					</TableCell>
					<TableCell className="text-right font-semibold">
						{fmtCur(data.totals.originalAmount)}
					</TableCell>
					<TableCell />
					<TableCell className="text-right font-semibold">
						{fmtCur(data.totals.totalRepaid)}
					</TableCell>
					<TableCell className="text-right font-semibold">
						{fmtCur(data.totals.outstandingBalance)}
					</TableCell>
					<TableCell />
					<TableCell />
					<TableCell />
				</>
			}
		/>
	);
}
