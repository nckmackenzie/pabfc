import { createFileRoute } from "@tanstack/react-router";
import {
	BasePageComponent,
	BasePageLoadingSkeleton,
} from "@/components/ui/base-page";
import { ProtectedPage } from "@/components/ui/protected-page";
import { useFilters } from "@/hooks/use-filters";
import { searchValidateSchema } from "@/lib/schema-rules";

export const Route = createFileRoute("/app/expenses/")({
	component: RouteComponent,
	validateSearch: searchValidateSchema,
	head: () => ({
		meta: [{ title: "Expenses / Prime Age Beauty & Fitness Center" }],
	}),
	pendingComponent: () => (
		<BasePageLoadingSkeleton
			pageDescription="Manage your expenses"
			pageTitle="Expenses"
		/>
	),
});

function RouteComponent() {
	const { filters, setFilters } = useFilters(Route.id);
	return (
		<ProtectedPage permissions={["expenses:view"]}>
			<BasePageComponent
				pageTitle="Expenses"
				pageDescription="Manage your expenses"
				hasNewButtonLink={true}
				newButtonLinkPath={"/app/expenses/new"}
				createPermissions={["expenses:create"]}
				defaultSearchValue={filters.q}
				onSearch={(val) => setFilters({ q: val })}
			>
				null
			</BasePageComponent>
		</ProtectedPage>
	);
}
