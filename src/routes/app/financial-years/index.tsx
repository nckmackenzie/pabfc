import { createFileRoute } from "@tanstack/react-router";
import { BasePageComponent } from "@/components/ui/base-page";
import { ProtectedPage } from "@/components/ui/protected-page";
import { FinancialYearsTable } from "@/features/financial-years/components/financial-years-table";
import { useFilters } from "@/hooks/use-filters";
import { requirePermission } from "@/lib/permissions/permissions";
import { searchValidateSchema } from "@/lib/schema-rules";

export const Route = createFileRoute("/app/financial-years/")({
	beforeLoad: async () => {
		await requirePermission("financial-years:view");
	},
	component: RouteComponent,
	validateSearch: searchValidateSchema,
	head: () => ({
		meta: [{ title: "Financial Years / Prime Age Beauty & Fitness Center" }],
	}),
});

function RouteComponent() {
	const { filters, setFilters } = useFilters(Route.id);
	return (
		<ProtectedPage permissions={["financial-years:view"]}>
			<BasePageComponent
				pageTitle="Financial Years"
				pageDescription="Create and manage financial years"
				hasNewButtonLink
				newButtonLinkPath="/app/financial-years/new"
				createPermissions={["financial-years:create"]}
				defaultSearchValue={filters.q}
				onSearch={(val) => setFilters({ q: val })}
				buttonText="Add Financial Year"
			>
				<FinancialYearsTable />
			</BasePageComponent>
		</ProtectedPage>
	);
}
