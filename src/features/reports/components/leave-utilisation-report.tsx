import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/datatable";
import { TableCell } from "@/components/ui/table";
import { getLeaveUtilisationReport } from "@/features/reports/services/leave-utilisation-report.api";
import { useFilters } from "@/hooks/use-filters";
import { dateFormat } from "@/lib/helpers";

const route = getRouteApi("/app/reports/human-resources/leave-utilisation/");

type DetailRow = Awaited<ReturnType<typeof getLeaveUtilisationReport>>["rows"][number];

type TableRow =
	| (DetailRow & { kind: "detail" })
	| {
			adjustmentDays: number | null;
			availableBalance: number;
			carryForwardExpiresAt: string | null;
			carriedForwardDays: number | null;
			departmentName: string | null;
			employeeId: string;
			employeeName: string;
			employeeNo: string;
			entitledDays: number;
			kind: "summary";
			leaveType: string;
			leaveTypeLabel: string;
			takenDays: number;
	  };

function numberCell(value: number | null, isSummary: boolean) {
	return (
		<div className={isSummary ? "text-right font-semibold" : "text-right"}>
			{value === null ? "-" : value}
		</div>
	);
}

export function LeaveUtilisationReportTable() {
	const { filters } = useFilters(route.id);
	const { data } = useSuspenseQuery({
		queryKey: ["reports", "human-resources", "leave-utilisation", filters],
		queryFn: () =>
			getLeaveUtilisationReport({
				data: {
					leaveYear: filters.leaveYear ?? new Date().getFullYear(),
					departmentId: filters.departmentId,
					employeeId: filters.employeeId,
				},
			}),
		staleTime: 0,
	});

	const summaryByEmployeeId = new Map(
		data.employeeSummaries.map((summary) => [summary.employeeId, summary] as const)
	);
	const tableRows = data.rows.reduce<Array<TableRow>>((acc, row, index, rows) => {
		acc.push({ ...row, kind: "detail" });
		const nextRow = rows[index + 1];
		if (!nextRow || nextRow.employeeId !== row.employeeId) {
			const summary = summaryByEmployeeId.get(row.employeeId);
			if (summary) {
				acc.push({
					kind: "summary",
					employeeId: summary.employeeId,
					employeeName: summary.employeeName,
					employeeNo: summary.employeeNo,
					departmentName: summary.departmentName,
					leaveType: "__total__",
					leaveTypeLabel: "Total (all types)",
					entitledDays: summary.totalEntitled,
					carriedForwardDays: null,
					adjustmentDays: null,
					takenDays: summary.totalTaken,
					availableBalance: summary.totalAvailable,
					carryForwardExpiresAt: null,
				});
			}
		}

		return acc;
	}, []);

	const columns: Array<ColumnDef<TableRow>> = [
		{
			accessorKey: "employeeName",
			header: "Employee Name",
			cell: ({ row }) => (
				<div className={row.original.kind === "summary" ? "font-semibold" : undefined}>
					{row.original.employeeName}
				</div>
			),
		},
		{
			accessorKey: "employeeNo",
			header: "Employee No",
			cell: ({ row }) => (
				<div className={row.original.kind === "summary" ? "font-semibold" : undefined}>
					{row.original.employeeNo}
				</div>
			),
		},
		{
			accessorKey: "departmentName",
			header: "Department",
			cell: ({ row }) => (
				<div className={row.original.kind === "summary" ? "font-semibold" : undefined}>
					{row.original.departmentName ?? "-"}
				</div>
			),
		},
		{
			accessorKey: "leaveTypeLabel",
			header: "Leave Type",
			cell: ({ row }) => (
				<div className={row.original.kind === "summary" ? "font-semibold" : undefined}>
					{row.original.leaveTypeLabel}
				</div>
			),
		},
		{
			accessorKey: "entitledDays",
			header: () => <div className="text-right">Entitled Days</div>,
			cell: ({ row }) => numberCell(row.original.entitledDays, row.original.kind === "summary"),
		},
		{
			accessorKey: "carriedForwardDays",
			header: () => <div className="text-right">Carried Forward Days</div>,
			cell: ({ row }) => numberCell(row.original.carriedForwardDays, row.original.kind === "summary"),
		},
		{
			accessorKey: "adjustmentDays",
			header: () => <div className="text-right">Adjustment Days</div>,
			cell: ({ row }) => numberCell(row.original.adjustmentDays, row.original.kind === "summary"),
		},
		{
			accessorKey: "takenDays",
			header: () => <div className="text-right">Taken Days</div>,
			cell: ({ row }) => numberCell(row.original.takenDays, row.original.kind === "summary"),
		},
		{
			accessorKey: "availableBalance",
			header: () => <div className="text-right">Available Balance</div>,
			cell: ({ row }) => numberCell(row.original.availableBalance, row.original.kind === "summary"),
		},
		{
			accessorKey: "carryForwardExpiresAt",
			header: "Carry Forward Expires",
			cell: ({ row }) =>
				row.original.carryForwardExpiresAt
					? dateFormat(row.original.carryForwardExpiresAt, "reporting")
					: "-",
		},
	];

	return (
		<DataTable
			data={tableRows}
			columns={columns}
			exportToExcel
			customFooter={
				<>
					<TableCell colSpan={4} className="font-semibold">
						Totals
					</TableCell>
					<TableCell className="text-right font-semibold">
						{data.totals.totalEntitled}
					</TableCell>
					<TableCell />
					<TableCell />
					<TableCell className="text-right font-semibold">
						{data.totals.totalTaken}
					</TableCell>
					<TableCell className="text-right font-semibold">
						{data.totals.totalAvailable}
					</TableCell>
					<TableCell />
				</>
			}
		/>
	);
}
