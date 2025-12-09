import { createFileRoute } from "@tanstack/react-router";
import { BasePageComponent } from "@/components/ui/base-page";
import { ProtectedPage } from "@/components/ui/protected-page";
import { useFilters } from "@/hooks/use-filters";
import { searchValidateSchema } from "@/lib/schema-rules";

export const Route = createFileRoute("/app/payments/")({
	component: RouteComponent,
	validateSearch: searchValidateSchema,
	head: () => ({
		meta: [{ title: "Payments / Prime Age Beauty & Fitness Club" }],
	}),
});

function RouteComponent() {
	const { filters, setFilters } = useFilters(Route.id);
	return (
		<ProtectedPage permissions={["payments:view"]}>
			<BasePageComponent
				pageTitle="Membership Payments"
				pageDescription="View and manage membership payments"
				hasNewButtonLink
				newButtonLinkPath="/app/payments/new"
				createPermissions={["payments:create"]}
				defaultSearchValue={filters.q}
				onSearch={(val) => setFilters({ q: val })}
				buttonText="Add Payment"
			/>
		</ProtectedPage>
	);
}
