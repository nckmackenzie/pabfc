import { createFileRoute } from "@tanstack/react-router";
import { BasePageComponent } from "@/components/ui/base-page";
import { ProtectedPage } from "@/components/ui/protected-page";
import { useFilters } from "@/hooks/use-filters";
import { requirePermission } from "@/lib/permissions/permissions";
import { searchValidateSchema } from "@/lib/schema-rules";

export const Route = createFileRoute("/app/bankings/")({
	beforeLoad: async () => {
		await requirePermission("banking:view");
	},
	component: BankingsIndexComponent,
	validateSearch: searchValidateSchema,
	head: () => ({
		meta: [
			{
				title: "Bankings / Prime Age Beauty & Fitness Center",
			},
		],
	}),
});

function BankingsIndexComponent() {
	const { setFilters, filters } = useFilters(Route.id);
	return (
		<ProtectedPage permissions={["banking:view"]}>
			<BasePageComponent
				pageTitle="Bankings"
				pageDescription="View and manage bankings"
				hasNewButtonLink
				newButtonLinkPath="/app/bankings/new"
				createPermissions={["banking:create"]}
				defaultSearchValue={filters.q}
				onSearch={(val) => setFilters({ q: val })}
				buttonText="Add Payment"
			>
				<p>Table here</p>
			</BasePageComponent>
		</ProtectedPage>
	);
}
