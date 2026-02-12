import { createFileRoute } from "@tanstack/react-router";
import {
	BasePageComponent,
	BasePageLoadingSkeleton,
} from "@/components/ui/base-page";
import { SuppliersTable } from "@/features/bills/components/suppliers-table";
import { supplierQueries } from "@/features/bills/services/queries";
import { useFilters } from "@/hooks/use-filters";
import { searchValidateSchema } from "@/lib/schema-rules";

export const Route = createFileRoute("/app/suppliers/")({
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "Suppliers / Prime Age Beauty & Fitness Centre" }],
	}),
	validateSearch: searchValidateSchema,
	loader: async ({ context: { queryClient } }) =>
		await queryClient.ensureQueryData(supplierQueries.list({})),
	pendingComponent: () => (
		<BasePageLoadingSkeleton
			pageTitle="Suppliers"
			pageDescription="Manage your suppliers"
		/>
	),
});

function RouteComponent() {
	const { setFilters } = useFilters(Route.id);
	return (
		<BasePageComponent
			pageTitle="Suppliers"
			pageDescription="Manage your suppliers"
			createPermissions={["bills:create"]}
			hasNewButtonLink
			newButtonLinkPath="/app/suppliers/new"
			defaultSearchValue=""
			onSearch={(val) => {
				setFilters({ q: val.trim().length > 0 ? val : undefined });
			}}
		>
			<SuppliersTable />
		</BasePageComponent>
	);
}
