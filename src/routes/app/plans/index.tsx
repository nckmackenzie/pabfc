import { createFileRoute } from "@tanstack/react-router";
import {
	BasePageComponent,
	BasePageLoadingSkeleton,
} from "@/components/ui/base-page";
import { PlansTable } from "@/features/plans/components/plans-table";
import { useFilters } from "@/hooks/use-filters";
import { requirePermission } from "@/lib/permissions/permissions";
import { searchValidateSchema } from "@/lib/schema-rules";

export const Route = createFileRoute("/app/plans/")({
	beforeLoad: async () => {
		await requirePermission("plans:view");
	},
	validateSearch: searchValidateSchema,
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "Plans & Packages / Prime Age Beauty & Fitness Center" }],
	}),
	pendingComponent: () => (
		<BasePageLoadingSkeleton
			pageTitle="Plans & Packages"
			pageDescription="View and manage plans & packages"
		/>
	),
});

function RouteComponent() {
	const { filters, setFilters } = useFilters(Route.id);
	return (
		<BasePageComponent
			pageTitle="Plans & Packages"
			pageDescription="View and manage plans & packages"
			buttonText="Create new Plan/Package"
			hasNewButtonLink={true}
			newButtonLinkPath="/app/plans/new"
			defaultSearchValue={filters.q}
			onSearch={(val) => setFilters({ q: val })}
			createPermissions={["plans:create"]}
		>
			<PlansTable />
		</BasePageComponent>
	);
}
