import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { EyeIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/datatable";
import { TableCell } from "@/components/ui/table";
import { SalaryAdvanceStatementSheet } from "@/features/reports/components/salary-advance-statement-sheet";
import { formatSalaryAdvanceStatus } from "@/features/reports/lib/salary-advance-report";
import { getSalaryAdvanceSummaryReport } from "@/features/reports/services/salary-advance-report.api";
import { getSalaryAdvanceStatusVariant } from "@/features/payroll/lib/salary-advance-options";
import { useFilters } from "@/hooks/use-filters";
import { useSheet } from "@/integrations/sheet-provider";
import { currencyFormatter, dateFormat } from "@/lib/helpers";

const route = getRouteApi("/app/reports/human-resources/salary-advances/");
const fmtCur = (value: number) => currencyFormatter(value, false);

export function SalaryAdvancesReportTable() {
	const { filters } = useFilters(route.id);
	const { setOpen } = useSheet();
	const { data } = useSuspenseQuery({
		queryKey: ["reports", "human-resources", "salary-advances", filters],
		queryFn: () =>
			getSalaryAdvanceSummaryReport({
				data: {
					employeeId: filters.employeeId,
					status: filters.status,
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
			accessorKey: "advanceId",
			header: "Advance ID/Reference",
		},
		{
			accessorKey: "applicationDate",
			header: "Application Date",
			cell: ({ row }) => dateFormat(row.original.applicationDate, "reporting"),
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
			accessorKey: "approvedAmount",
			header: () => <div className="text-right">Approved Amount (KES)</div>,
			cell: ({ row }) => <div className="text-right">{fmtCur(row.original.approvedAmount)}</div>,
		},
		{
			accessorKey: "monthlyRecoveryAmount",
			header: () => <div className="text-right">Monthly Recovery Amount (KES)</div>,
			cell: ({ row }) => (
				<div className="text-right">{fmtCur(row.original.monthlyRecoveryAmount)}</div>
			),
		},
		{
			accessorKey: "totalRecovered",
			header: () => <div className="text-right">Total Recovered (KES)</div>,
			cell: ({ row }) => <div className="text-right">{fmtCur(row.original.totalRecovered)}</div>,
		},
		{
			accessorKey: "outstandingBalance",
			header: () => <div className="text-right">Outstanding Balance (KES)</div>,
			cell: ({ row }) => (
				<div className="text-right">{fmtCur(row.original.outstandingBalance)}</div>
			),
		},
		{
			accessorKey: "recoveriesProcessed",
			header: () => <div className="text-right">Recoveries Processed</div>,
			cell: ({ row }) => <div className="text-right">{row.original.recoveriesProcessed}</div>,
		},
		{
			accessorKey: "approvedRecoveryMonths",
			header: () => <div className="text-right">Approved Recovery Months</div>,
			cell: ({ row }) => <div className="text-right">{row.original.approvedRecoveryMonths}</div>,
		},
		{
			accessorKey: "recoveriesRemaining",
			header: () => <div className="text-right">Recoveries Remaining</div>,
			cell: ({ row }) => <div className="text-right">{row.original.recoveriesRemaining}</div>,
		},
		{
			accessorKey: "status",
			header: "Status",
			cell: ({ row }) => (
				<Badge
					variant={getSalaryAdvanceStatusVariant(row.original.status) ?? "secondary"}
					className="capitalize"
				>
					{formatSalaryAdvanceStatus(row.original.status)}
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
						setOpen(<SalaryAdvanceStatementSheet advanceId={row.original.advanceId} />, {
							className: "max-w-6xl!",
							title: "Salary Advance Statement",
							description: `Recovery statement for ${row.original.employeeName}.`,
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
					<TableCell colSpan={4} className="font-semibold">
						Totals
					</TableCell>
					<TableCell className="text-right font-semibold">
						{fmtCur(data.totals.approvedAmount)}
					</TableCell>
					<TableCell />
					<TableCell className="text-right font-semibold">
						{fmtCur(data.totals.totalRecovered)}
					</TableCell>
					<TableCell className="text-right font-semibold">
						{fmtCur(data.totals.outstandingBalance)}
					</TableCell>
					<TableCell />
					<TableCell />
					<TableCell />
					<TableCell />
					<TableCell />
				</>
			}
		/>
	);
}
