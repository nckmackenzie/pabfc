import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, getRouteApi } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { CheckButton, ViewDetailsAction } from "@/components/ui/custom-button";
import { DataTable } from "@/components/ui/datatable";
import { DatatableActions } from "@/components/ui/datatable-actions";
import { DataTableColumnHeader } from "@/components/ui/datatable-column-header";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty";
import { CalculatorIcon } from "@/components/ui/icons";
import { PermissionGate } from "@/components/ui/permission-gate";
import { formatPayrollPeriod } from "@/features/payroll/lib/overtime-options";
import {
	approveOvertimeRecordFn,
	revokeOvertimeApprovalFn,
	type OvertimePeriodRecord,
} from "@/features/payroll/services/overtime.api";
import { overtimeQueries } from "@/features/payroll/services/queries";
import { useFilters } from "@/hooks/use-filters";
import { currencyFormatter } from "@/lib/helpers";
import { toTitleCase } from "@/lib/utils";
import toast from "react-hot-toast";

const statusVariant = {
	draft: "warning",
	approved: "success",
	paid: "secondary",
} as const;
const defaultSummarySearch = {
	fromMonth: 1,
	fromYear: new Date().getUTCFullYear(),
	toMonth: new Date().getUTCMonth() + 1,
	toYear: new Date().getUTCFullYear(),
} as const;

function OvertimeRecordActions({ record }: { record: OvertimePeriodRecord }) {
	const queryClient = useQueryClient();

	const approveMutation = useMutation({
		mutationFn: async () => {
			const result = await approveOvertimeRecordFn({
				data: { recordId: record.id },
			});

			if (!result.success) {
				throw new Error(result.error.message);
			}

			return result.data;
		},
		onSuccess: async (result) => {
			if (result.warnings.length > 0) {
				toast.error(result.warnings.join(" "));
			} else {
				toast.success("Overtime record approved successfully.");
			}
			await queryClient.invalidateQueries({ queryKey: ["overtime-records"] });
		},
		onError: (error) => {
			toast.error(error instanceof Error ? error.message : "Failed to approve overtime record.");
		},
	});

	const revokeMutation = useMutation({
		mutationFn: async () => {
			const result = await revokeOvertimeApprovalFn({
				data: { recordId: record.id },
			});

			if (!result.success) {
				throw new Error(result.error.message);
			}

			return result.data;
		},
		onSuccess: async () => {
			toast.success("Overtime approval revoked successfully.");
			await queryClient.invalidateQueries({ queryKey: ["overtime-records"] });
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to revoke overtime approval."
			);
		},
	});

	return (
		<DatatableActions>
			<PermissionGate permission="overtime-records:view">
				<DropdownMenuItem asChild>
					<Link
						to="/app/payroll/overtime/employee/$employeeId"
						params={{ employeeId: record.employeeId }}
						search={defaultSummarySearch}
					>
						<ViewDetailsAction text="History" />
					</Link>
				</DropdownMenuItem>
				<DropdownMenuItem asChild>
					<Link to="/app/payroll/overtime/$recordId" params={{ recordId: record.id }}>
						<ViewDetailsAction />
					</Link>
				</DropdownMenuItem>
			</PermissionGate>
			{record.status === "draft" ? (
				<PermissionGate permission="overtime-records:approve">
					<DropdownMenuItem onSelect={() => approveMutation.mutate()}>
						<CheckButton text={approveMutation.isPending ? "Approving..." : "Approve"} />
					</DropdownMenuItem>
				</PermissionGate>
			) : null}
			{record.status === "approved" && !record.payrollSlipId ? (
				<PermissionGate permission="overtime-records:approve">
					<DropdownMenuItem onSelect={() => revokeMutation.mutate()}>
						<CheckButton text={revokeMutation.isPending ? "Revoking..." : "Revoke"} />
					</DropdownMenuItem>
				</PermissionGate>
			) : null}
		</DatatableActions>
	);
}

export function OvertimeRecordsTable() {
	const { filters } = useFilters(getRouteApi("/app/payroll/overtime/").id);
	const { data } = useSuspenseQuery(overtimeQueries.period(filters));

	const columns: Array<ColumnDef<OvertimePeriodRecord>> = [
		{
			accessorKey: "employeeNo",
			header: ({ column }) => <DataTableColumnHeader column={column} title="Employee No" />,
			cell: ({ row }) => <span className="font-mono">E{row.original.employeeNo}</span>,
		},
		{
			accessorKey: "fullName",
			header: ({ column }) => <DataTableColumnHeader column={column} title="Employee" />,
			cell: ({ row }) => toTitleCase(row.original.fullName),
		},
		{
			accessorKey: "departmentName",
			header: "Department",
			cell: ({ row }) => row.original.departmentName ?? "-",
		},
		{
			id: "period",
			header: "Period",
			cell: ({ row }) => formatPayrollPeriod(row.original.periodMonth, row.original.periodYear),
		},
		{
			id: "totalHours",
			header: "Total Hours",
			cell: ({ row }) =>
				(
					row.original.weekdayOvertimeHours +
					row.original.weekendOvertimeHours +
					row.original.publicHolidayOvertimeHours
				).toFixed(2),
		},
		{
			accessorKey: "overtimeHourlyRate",
			header: "Hourly Rate",
			cell: ({ row }) => currencyFormatter(row.original.overtimeHourlyRate),
		},
		{
			accessorKey: "totalOvertimePay",
			header: "Total Pay",
			cell: ({ row }) => currencyFormatter(row.original.totalOvertimePay),
		},
		{
			accessorKey: "status",
			header: "Status",
			cell: ({ row }) => (
				<Badge variant={statusVariant[row.original.status]}>
					{toTitleCase(row.original.status)}
				</Badge>
			),
		},
		{
			id: "actions",
			cell: ({ row }) => <OvertimeRecordActions record={row.original} />,
		},
	];

	if (!data.length && !filters.q && !filters.status && !filters.departmentId) {
		return (
			<EmptyState
				title="No Overtime Records"
				description="Overtime records for the selected month will appear here once they are created."
				icon={<CalculatorIcon />}
			/>
		);
	}

	return <DataTable columns={columns} data={data} />;
}
