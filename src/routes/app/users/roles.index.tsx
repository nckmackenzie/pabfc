import { createFileRoute } from "@tanstack/react-router";
import {
	BasePageComponent,
	BasePageLoadingSkeleton,
} from "@/components/ui/base-page";
import { BackLink } from "@/components/ui/links";
import { RolesTable } from "@/features/users/components/roles-table";
import { useFilters } from "@/hooks/use-filters";
import { searchValidateSchema } from "@/lib/schema-rules";

export const Route = createFileRoute("/app/users/roles/")({
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "Roles / Prime Age Beauty & Fitness Center" }],
	}),
	staticData: {
		breadcrumb: "Roles List",
	},
	validateSearch: searchValidateSchema,
	pendingComponent: () => <BasePageLoadingSkeleton />,
});

function RouteComponent() {
	const { filters, setFilters } = useFilters(Route.id);
	return (
		<div className="space-y-6">
			<BackLink href="/app/users" variant="outline" className="ml-0.5">
				Back to users
			</BackLink>
			<BasePageComponent
				pageTitle="Roles & Permissions"
				pageDescription="Manage user roles and permissions"
				hasNewButtonLink
				newButtonLinkPath="/app/users/roles/new"
				buttonText="New Role"
				searchPlaceholder="Search role..."
				defaultSearchValue={filters.q}
				onSearch={(value) =>
					setFilters({
						q: value.trim().length > 0 ? value : undefined,
					})
				}
			>
				<RolesTable />
			</BasePageComponent>
		</div>
	);
}
