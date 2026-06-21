import { getRouteApi } from "@tanstack/react-router";
import { BasePageComponent } from "@/components/ui/base-page";
import { ErrorBoundaryWithSuspense } from "@/components/ui/error-boundary-with-suspense";
import { DatatableSkeleton } from "@/components/ui/loaders";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { SalaryAdvancesActiveTable } from "@/features/payroll/components/salary-advances-active-table";
import { SalaryAdvancesPendingTable } from "@/features/payroll/components/salary-advances-pending-table";
import { SALARY_ADVANCE_ACTIVE_STATUS_OPTIONS } from "@/features/payroll/lib/salary-advance-options";
import { useFilters } from "@/hooks/use-filters";

export function SalaryAdvancesPage({
	departments,
	employees,
}: {
	departments: Array<{
		id: number;
		name: string;
	}>;
	employees: Array<{
		departmentId: number | null;
		employeeNo: string;
		fullName: string;
		id: string;
	}>;
}) {
	const { filters, setFilters } = useFilters(getRouteApi("/app/payroll/salary-advances/").id);
	const activeView = filters.view === "active";

	return (
		<BasePageComponent
			pageTitle="Salary Advances"
			pageDescription="Manage salary advance applications, disbursements, and payroll recoveries."
			hasNewButtonLink
			newButtonLinkPath="/app/payroll/salary-advances/new"
			buttonText="Apply For Salary Advance"
			createPermissions={["salary-advances:create"]}
			filterClassName="md:justify-end"
			customFilters={
				<div className="grid gap-3 md:grid-cols-3">
					<Select
						value={filters.view ?? "pending"}
						onValueChange={(value) =>
							setFilters({
								view: value,
							})
						}
					>
						<SelectTrigger className="w-full">
							<SelectValue placeholder="View" />
						</SelectTrigger>
						<SelectContent>
							{SALARY_ADVANCE_ACTIVE_STATUS_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					{activeView ? (
						<Select
							value={filters.departmentId ? String(filters.departmentId) : "all"}
							onValueChange={(value) =>
								setFilters({
									departmentId: value === "all" ? undefined : Number(value),
								})
							}
						>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="Department" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Departments</SelectItem>
								{departments.map((department) => (
									<SelectItem key={department.id} value={String(department.id)}>
										{department.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					) : (
						<div />
					)}

					{activeView ? (
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
					) : (
						<div />
					)}
				</div>
			}
		>
			<ErrorBoundaryWithSuspense loader={<DatatableSkeleton />}>
				{activeView ? <SalaryAdvancesActiveTable /> : <SalaryAdvancesPendingTable />}
			</ErrorBoundaryWithSuspense>
		</BasePageComponent>
	);
}
