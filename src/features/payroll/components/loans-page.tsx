import { getRouteApi } from "@tanstack/react-router";
import { BasePageComponent } from "@/components/ui/base-page";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { LOAN_STATUS_OPTIONS } from "@/features/payroll/lib/loan-options";
import { LoansTable } from "@/features/payroll/components/loans-table";
import { useFilters } from "@/hooks/use-filters";
import { ErrorBoundaryWithSuspense } from "@/components/ui/error-boundary-with-suspense";
import { DatatableSkeleton } from "@/components/ui/loaders";

export function LoansPage({
	employees,
}: {
	employees: Array<{
		departmentId: number | null;
		employeeNo: string;
		fullName: string;
		id: string;
	}>;
}) {
	const { filters, setFilters } = useFilters(getRouteApi("/app/payroll/loans/").id);

	return (
		<BasePageComponent
			pageTitle="Employee Loans"
			pageDescription="Manage employee loan applications, approvals, disbursements, and repayment workflow."
			hasNewButtonLink
			newButtonLinkPath="/app/payroll/loans/new"
			buttonText="Apply For Loan"
			createPermissions={["employee-loans:create"]}
			defaultSearchValue={filters.q}
			searchPlaceholder="Search employee number or name..."
			onSearch={(q) => setFilters({ q })}
			customFilters={
				<div className="grid gap-3 md:grid-cols-3">
					<Select
						value={filters.status ?? "all"}
						onValueChange={(value) => setFilters({ status: value })}
					>
						<SelectTrigger className="w-full">
							<SelectValue placeholder="Status" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Statuses</SelectItem>
							{LOAN_STATUS_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Select
						value={filters.employeeId ?? "all"}
						onValueChange={(value) =>
							setFilters({
								employeeId: value === "all" ? undefined : value,
							})
						}
					>
						<SelectTrigger className="w-full">
							<SelectValue placeholder="Employee" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Employees</SelectItem>
							{employees.map((employee) => (
								<SelectItem key={employee.id} value={employee.id}>
									{`E${employee.employeeNo} - ${employee.fullName}`}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			}
		>
			<ErrorBoundaryWithSuspense loader={<DatatableSkeleton />}>
				<LoansTable />
			</ErrorBoundaryWithSuspense>
		</BasePageComponent>
	);
}
