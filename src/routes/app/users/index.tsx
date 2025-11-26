import { createFileRoute } from "@tanstack/react-router";
import {
	BasePageComponent,
	BasePageLoadingSkeleton,
} from "@/components/ui/base-page";
import { ShieldCheckIcon } from "@/components/ui/icons";
import { ButtonLink } from "@/components/ui/links";
import { UsersTable } from "@/features/users/components/user-table";
import { useFilters } from "@/hooks/use-filters";
import { searchValidateSchema } from "@/lib/schema-rules";

export const Route = createFileRoute("/app/users/")({
	component: RouteComponent,
	validateSearch: searchValidateSchema,
	head: () => ({
		meta: [{ title: "Users / Prime Age Beauty & Fitness Center" }],
	}),
	pendingComponent: () => (
		<BasePageLoadingSkeleton
			pageDescription="Create and manage application users"
			pageTitle="Users"
		/>
	),
});

function RouteComponent() {
	const { setFilters, filters } = useFilters(Route.id);
	return (
		<BasePageComponent
			pageTitle="Users"
			pageDescription="Create and manage application users"
			hasNewButtonLink
			newButtonLinkPath="/app/users/new"
			buttonText="Create new User"
			onSearch={(val) => setFilters({ q: val })}
			defaultSearchValue={filters.q}
			searchPlaceholder="Search users..."
			extraActionButtons={
				<ButtonLink
					variant="outline"
					path="/app/users/roles"
					icon={<ShieldCheckIcon />}
				>
					Roles & Permissions
				</ButtonLink>
			}
		>
			<UsersTable />
		</BasePageComponent>
	);
}
