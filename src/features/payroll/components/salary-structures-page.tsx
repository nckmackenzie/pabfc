import { BasePageComponent } from "@/components/ui/base-page";
import { SalaryStructuresTable } from "@/features/payroll/components/salary-structures-table";
import { useFilters } from "@/hooks/use-filters";
import { getRouteApi } from "@tanstack/react-router";

export function SalaryStructuresPage() {
	const { filters, setFilters } = useFilters(
		getRouteApi("/app/payroll/salary-structures/").id,
	);

	return (
		<BasePageComponent
			pageTitle="Salary Structures"
			pageDescription="Manage effective-dated compensation records for payroll and audit history."
			hasNewButtonLink
			newButtonLinkPath="/app/payroll/salary-structures/new"
			buttonText="Add Salary Structure"
			createPermissions={["salary-structures:create"]}
			defaultSearchValue={filters.q}
			searchPlaceholder="Search employee number, name, or job title..."
			onSearch={(q) => setFilters({ q })}
		>
			<SalaryStructuresTable />
		</BasePageComponent>
	);
}
