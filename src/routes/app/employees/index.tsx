import { createFileRoute } from "@tanstack/react-router";
import {
	BasePageComponent,
	BasePageLoadingSkeleton,
} from "@/components/ui/base-page";
import { EmployeesTable } from "@/features/employees/components/employees-table";
import { useFilters } from "@/hooks/use-filters";
import { seo } from "@/lib/helpers";
import { requirePermission } from "@/lib/permissions/permissions";
import { searchValidateSchema } from "@/lib/schema-rules";

export const Route = createFileRoute("/app/employees/")({
	component: RouteComponent,
	head: () => ({ meta: seo({ title: "Employees" }) }),
	validateSearch: searchValidateSchema,
	beforeLoad: async () => {
		await requirePermission("employees:view");
	},
	pendingComponent: () => (
		<BasePageLoadingSkeleton
			pageTitle="Employees"
			pageDescription="View and manage employees"
		/>
	),
});

function RouteComponent() {
	const { filters, setFilters } = useFilters(Route.id);
	return (
		<BasePageComponent
			pageTitle="Employees"
			pageDescription="View and manage employees"
			buttonText="Create new Employee"
			hasNewButtonLink={true}
			newButtonLinkPath="/app/employees/new"
			createPermissions={["employees:create"]}
			defaultSearchValue={filters.q}
			searchPlaceholder="Search employee..."
			onSearch={(val) => setFilters({ q: val })}
		>
			<EmployeesTable />
		</BasePageComponent>
	);
}
