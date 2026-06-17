import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, getRouteApi } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { ViewDetailsAction } from "@/components/ui/custom-button";
import { DataTable } from "@/components/ui/datatable";
import { DatatableActions } from "@/components/ui/datatable-actions";
import { DataTableColumnHeader } from "@/components/ui/datatable-column-header";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty";
import { FileSpreadsheetIcon } from "@/components/ui/icons";
import { PermissionGate } from "@/components/ui/permission-gate";
import { LOAN_STATUS_VARIANTS } from "@/features/payroll/lib/loan-options";
import { formatPayrollPeriod } from "@/features/payroll/lib/overtime-options";
import type { LoanListItemView } from "@/features/payroll/services/loans.api";
import { loanQueries } from "@/features/payroll/services/queries";
import { useFilters } from "@/hooks/use-filters";
import { currencyFormatter } from "@/lib/helpers";

function getLoanStatusVariant(status: string) {
	return LOAN_STATUS_VARIANTS[status as keyof typeof LOAN_STATUS_VARIANTS];
}

function LoanActions({ loan }: { loan: LoanListItemView }) {
	return (
		<DatatableActions>
			<PermissionGate permission="employee-loans:view">
				<DropdownMenuItem asChild>
					<Link to="/app/payroll/loans/$loanId" params={{ loanId: loan.id }}>
						<ViewDetailsAction />
					</Link>
				</DropdownMenuItem>
			</PermissionGate>
		</DatatableActions>
	);
}

export function LoansTable() {
	const { filters } = useFilters(getRouteApi("/app/payroll/loans/").id);
	const { data } = useSuspenseQuery(loanQueries.list(filters));

	const columns: Array<ColumnDef<LoanListItemView>> = [
		{
			accessorKey: "employeeNo",
			header: ({ column }) => <DataTableColumnHeader column={column} title="Employee No" />,
			cell: ({ row }) => <span className="font-mono">E{row.original.employeeNo}</span>,
		},
		{
			accessorKey: "fullName",
			header: ({ column }) => <DataTableColumnHeader column={column} title="Employee" />,
		},
		{
			accessorKey: "approvedAmount",
			header: "Loan Amount",
			cell: ({ row }) =>
				currencyFormatter(row.original.approvedAmount ?? row.original.principalAmount),
		},
		{
			accessorKey: "outstandingBalance",
			header: "Outstanding",
			cell: ({ row }) => currencyFormatter(row.original.outstandingBalance ?? 0),
		},
		{
			accessorKey: "monthlyInstalment",
			header: "Monthly Instalment",
			cell: ({ row }) => currencyFormatter(row.original.monthlyInstalment ?? 0),
		},
		{
			id: "repaymentStart",
			header: "Repayment Start",
			cell: ({ row }) =>
				row.original.repaymentStartMonth && row.original.repaymentStartYear
					? formatPayrollPeriod(row.original.repaymentStartMonth, row.original.repaymentStartYear)
					: "-",
		},
		{
			accessorKey: "status",
			header: "Status",
			cell: ({ row }) => (
				<Badge variant={getLoanStatusVariant(row.original.status)} className="capitalize">
					{row.original.status.replaceAll("_", " ")}
				</Badge>
			),
		},
		{
			id: "actions",
			cell: ({ row }) => <LoanActions loan={row.original} />,
		},
	];

	if (!data.length) {
		return (
			<EmptyState
				title="No Employee Loans"
				description="Loan applications that match the current filters will appear here."
				icon={<FileSpreadsheetIcon />}
			/>
		);
	}

	return <DataTable columns={columns} data={data} />;
}
