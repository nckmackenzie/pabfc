import { assertCan } from "@/lib/permissions/can";
import { createFileRoute } from "@tanstack/react-router";
import { BasePageComponent, BasePageLoadingSkeleton } from "@/components/ui/base-page";
import { PackageIcon } from "@/components/ui/icons";
import { ButtonLink } from "@/components/ui/links";
import { PlansTable } from "@/features/plans/components/plans-table";
import { planQueries } from "@/features/plans/services/queries";
import { useFilters } from "@/hooks/use-filters";
import { searchValidateSchema } from "@/lib/schema-rules";

export const Route = createFileRoute("/app/plans/")({
	beforeLoad: ({ context }) => {
		assertCan(context.auth, "plans:view");
	},
	validateSearch: searchValidateSchema,
	loaderDeps: ({ search }) => search,
	loader: ({ context, deps }) => context.queryClient.ensureQueryData(planQueries.list(deps)),
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
			extraActionButtons={
				<ButtonLink variant="outline" path="/app/plans/addons" icon={<PackageIcon />}>
					Manage Addons
				</ButtonLink>
			}
		>
			<PlansTable />
		</BasePageComponent>
	);
}
