import { getRouteApi } from "@tanstack/react-router";
import { BasePageComponent } from "@/components/ui/base-page";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	OVERTIME_STATUS_OPTIONS,
	PAYROLL_MONTH_OPTIONS,
	getPayrollYearOptions,
} from "@/features/payroll/lib/overtime-options";
import { OvertimeRecordsTable } from "@/features/payroll/components/overtime-records-table";
import { useFilters } from "@/hooks/use-filters";

const yearOptions = getPayrollYearOptions({
	startYear: 2020,
	endYear: new Date().getUTCFullYear(),
});

export function OvertimeRecordsPage({
	departments,
}: {
	departments: Array<{
		id: number;
		name: string;
	}>;
}) {
	const { filters, setFilters } = useFilters(getRouteApi("/app/payroll/overtime/").id);

	return (
		<BasePageComponent
			pageTitle="Overtime Records"
			pageDescription="Manage monthly overtime records, approvals, and payroll-ready overtime totals."
			hasNewButtonLink
			newButtonLinkPath="/app/payroll/overtime/new"
			buttonText="Add Overtime Record"
			createPermissions={["overtime-records:create"]}
			defaultSearchValue={filters.q}
			searchPlaceholder="Search employee number or name..."
			onSearch={(q) => setFilters({ q })}
			customFilters={
				<div className="grid gap-3 md:grid-cols-4">
					<Select
						value={String(filters.periodMonth)}
						onValueChange={(value) =>
							setFilters({ periodMonth: Number(value) })
						}
					>
						<SelectTrigger className="w-full">
							<SelectValue placeholder="Month" />
						</SelectTrigger>
						<SelectContent>
							{PAYROLL_MONTH_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={String(option.value)}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Select
						value={String(filters.periodYear)}
						onValueChange={(value) => setFilters({ periodYear: Number(value) })}
					>
						<SelectTrigger className="w-full">
							<SelectValue placeholder="Year" />
						</SelectTrigger>
						<SelectContent>
							{yearOptions.map((option) => (
								<SelectItem key={option.value} value={String(option.value)}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Select
						value={filters.status ?? "all"}
						onValueChange={(value) =>
							setFilters({ status: value === "all" ? undefined : value })
						}
					>
						<SelectTrigger className="w-full">
							<SelectValue placeholder="Status" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Statuses</SelectItem>
							{OVERTIME_STATUS_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
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
				</div>
			}
		>
			<OvertimeRecordsTable />
		</BasePageComponent>
	);
}
