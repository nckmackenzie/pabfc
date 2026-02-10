import { createFileRoute } from "@tanstack/react-router";
import { BasePageComponent } from "@/components/ui/base-page";
import { ProtectedPage } from "@/components/ui/protected-page";
import { ReceiptsTable } from "@/features/receipts/components/payment-table";
import { paymentsSearchValidateSchema } from "@/features/receipts/services/schemas";
import { useFilters } from "@/hooks/use-filters";
import { requirePermission } from "@/lib/permissions/permissions";

export const Route = createFileRoute("/app/receipts/")({
	beforeLoad: async () => {
		await requirePermission("receipts:view");
	},
	component: RouteComponent,
	validateSearch: paymentsSearchValidateSchema,
	head: () => ({
		meta: [{ title: "Receipts / Prime Age Beauty & Fitness Club" }],
	}),
});

function RouteComponent() {
	const { filters, setFilters } = useFilters(Route.id);
	return (
		<ProtectedPage permissions={["receipts:view"]}>
			<BasePageComponent
				pageTitle="Membership Receipts"
				pageDescription="View and manage membership receipts"
				hasNewButtonLink
				newButtonLinkPath="/app/receipts/new"
				createPermissions={["receipts:create"]}
				defaultSearchValue={filters.q}
				onSearch={(val) => setFilters({ q: val })}
				buttonText="Add Receipt"
			>
				<ReceiptsTable />
			</BasePageComponent>
		</ProtectedPage>
	);
}
