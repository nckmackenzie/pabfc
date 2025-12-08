import { createFileRoute } from "@tanstack/react-router";
import { BasePageComponent } from "@/components/ui/base-page";
import { ProtectedPage } from "@/components/ui/protected-page";
import { ChartOfAccountsTable } from "@/features/coa/components/coa-datatable";
import { useFilters } from "@/hooks/use-filters";
import { searchValidateSchema } from "@/lib/schema-rules";

export const Route = createFileRoute("/app/chart-of-accounts/")({
	component: RouteComponent,
	validateSearch: searchValidateSchema,
	head: () => ({
		meta: [{ title: "Chart of Accounts / Prime Age Beauty & Fitness Center" }],
	}),
});

function RouteComponent() {
	const { filters, setFilters } = useFilters(Route.id);
	return (
		<ProtectedPage permissions={["chart-of-accounts:view"]}>
			<BasePageComponent
				pageTitle="Chart of Accounts"
				pageDescription="Manage your chart of accounts"
				hasNewButtonLink={true}
				newButtonLinkPath={"/app/chart-of-accounts/new"}
				createPermissions={["chart-of-accounts:create"]}
				defaultSearchValue={filters.q}
				onSearch={(val) => setFilters({ q: val })}
			>
				<ChartOfAccountsTable />
			</BasePageComponent>
		</ProtectedPage>
	);
}
