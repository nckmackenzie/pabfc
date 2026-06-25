import { Badge } from "@/components/ui/badge";
import { BasePageComponent, BasePageLoadingSkeleton } from "@/components/ui/base-page";
import { CustomDropdownContent } from "@/components/ui/custom-dropdown-content";
import { CustomDropdownTrigger } from "@/components/ui/custom-dropdown-trigger";
import { DataTable } from "@/components/ui/datatable";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { PAYROLL_PERIOD_STATUS } from "@/features/payroll/lib/payroll-constants";
import type { PayrollPeriodView } from "@/features/payroll/lib/payroll-period/types";

import { payrollPeriodQueries } from "@/features/payroll/services/queries";
import { useFilters } from "@/hooks/use-filters";
import { currencyFormatter, seo } from "@/lib/helpers";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { createFileRoute, getRouteApi, type RouteApi } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import {
	BadgeCheckIcon,
	CheckCheckIcon,
	CheckIcon,
	ClockIcon,
	ReceiptTextIcon,
	SquarePenIcon,
	XIcon,
} from "lucide-react";

const statusLabelMap: Record<PayrollPeriodView["status"], string> = {
	draft: "Draft",
	processing: "Processing",
	approved: "Approved",
	paid: "Paid",
	closed: "Closed",
	cancelled: "Cancelled",
};

export const Route = createFileRoute("/app/payroll/periods/")({
	component: RouteComponent,
	head: () => ({ meta: seo({ title: "Payroll Periods" }) }),
	pendingComponent: () => (
		<BasePageLoadingSkeleton
			pageTitle="Payroll Periods"
			pageDescription="Manage payroll lifecycle periods and compliance deadlines."
		/>
	),
	staticData: {
		breadcrumb: "Payroll Periods",
	},
});

function RouteComponent() {
	const route = getRouteApi("/app/payroll/periods/");

	return (
		<BasePageComponent
			pageTitle="Payroll Periods"
			pageDescription="Manage payroll lifecycle periods and compliance deadlines."
			buttonText="Add Payroll Period"
			hasNewButtonLink
			newButtonLinkPath="/app/payroll/periods/new"
			filterClassName="md:justify-end"
		>
			<PayrollPeriodTable route={route} />
		</BasePageComponent>
	);
}

function PayrollPeriodTable({ route }: { route: RouteApi<"/app/payroll/periods/"> }) {
	const { filters } = useFilters(route.id);
	const { data } = useSuspenseQuery(payrollPeriodQueries.list(filters));
	const columns: Array<ColumnDef<PayrollPeriodView>> = [
		{
			accessorKey: "name",
			header: "Period Name",
		},
		{
			accessorKey: "periodYear",
			header: "Period",
			cell: ({ row }) => {
				const date = new Date(row.original.periodYear, row.original.periodMonth - 1, 1);
				return `${format(date, "MMM yyyy")}`;
			},
		},
		{
			accessorKey: "employeeCount",
			header: "No. of Employees",
			cell: ({ row }) => {
				const employeeCount = row.original.employeeCount ?? 0;
				return <>{employeeCount}</>;
			},
		},
		{
			accessorKey: "totalNetPay",
			header: "Total Net Pay",
			cell: ({ row }) => currencyFormatter(row.original.totalNetPay ?? "0"),
		},
		{
			accessorKey: "status",
			header: "Status",
			cell: ({ row }) => {
				return <PayrollPeriodStatusBadge status={row.original.status} />;
			},
		},
		{
			id: "actions",
			cell: ({
				row: {
					original: { status, id },
				},
			}) => {
				if (status === PAYROLL_PERIOD_STATUS.CANCELLED) return null;
				return (
					<DropdownMenu>
						<CustomDropdownTrigger />
						<CustomDropdownContent>
							{status === PAYROLL_PERIOD_STATUS.DRAFT && (
								<DropdownMenuItem asChild>
									<Link to="/app/payroll/periods/$periodId/edit" params={{ periodId: id }}>
										<SquarePenIcon />
										Edit Period
									</Link>
								</DropdownMenuItem>
							)}
							<DropdownMenuItem asChild>
								<Link to="/app/payroll/periods/$periodId" params={{ periodId: id }}>
									<ReceiptTextIcon />
									Inspect Period
								</Link>
							</DropdownMenuItem>
						</CustomDropdownContent>
					</DropdownMenu>
				);
			},
		},
	];
	return <DataTable data={data} columns={columns} />;
}

export function PayrollPeriodStatusBadge({ status }: { status: PayrollPeriodView["status"] }) {
	if (status === PAYROLL_PERIOD_STATUS.CLOSED) {
		return (
			<Badge variant="success">
				<BadgeCheckIcon className="h-3 w-3" />
				Closed
			</Badge>
		);
	}

	if (status === PAYROLL_PERIOD_STATUS.CANCELLED) {
		return (
			<Badge variant="secondary">
				<XIcon className="h-3 w-3" />
				Cancelled
			</Badge>
		);
	}

	if (status === PAYROLL_PERIOD_STATUS.APPROVED || status === PAYROLL_PERIOD_STATUS.PAID) {
		return (
			<Badge variant="info">
				<CheckIcon className="h-3 w-3" />
				{statusLabelMap[status]}
			</Badge>
		);
	}

	if (status === PAYROLL_PERIOD_STATUS.PROCESSING) {
		return (
			<Badge variant="warning">
				<ClockIcon className="h-3 w-3" />
				Processing
			</Badge>
		);
	}

	return (
		<Badge variant="outline">
			<SquarePenIcon className="h-3 w-3" />
			Draft
		</Badge>
	);
}
