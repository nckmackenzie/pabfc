import { createFileRoute } from "@tanstack/react-router";
import {
	BasePageComponent,
	BasePageLoadingSkeleton,
} from "@/components/ui/base-page";
import { ProtectedPage } from "@/components/ui/protected-page";
import { RemittancesTable } from "@/features/wht-remittances/components/remittance-table";
import { useFilters } from "@/hooks/use-filters";
import { requirePermission } from "@/lib/permissions/permissions";
import { searchValidateSchema } from "@/lib/schema-rules";

export const Route = createFileRoute("/app/wht-remittances/")({
	beforeLoad: async () => {
		await requirePermission("wht-remittances:view");
	},
	component: RouteComponent,
	validateSearch: searchValidateSchema,
	head: () => ({
		meta: [{ title: "WHT Remittances / Prime Age Beauty & Fitness Club" }],
	}),
	pendingComponent: BasePageLoadingSkeleton,
});

function RouteComponent() {
	const { filters, setFilters } = useFilters(Route.id);
	return (
		<ProtectedPage permissions={["wht-remittances:view"]}>
			<BasePageComponent
				pageTitle="WHT Remittances"
				pageDescription="Remit withholding tax deducted on bills to KRA"
				hasNewButtonLink
				newButtonLinkPath="/app/wht-remittances/new"
				createPermissions={["wht-remittances:create"]}
				defaultSearchValue={filters.q}
				onSearch={(val) => setFilters({ q: val })}
				buttonText="Add Remittance"
			>
				<RemittancesTable />
			</BasePageComponent>
		</ProtectedPage>
	);
}
