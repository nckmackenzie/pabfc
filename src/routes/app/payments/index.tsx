import { createFileRoute } from "@tanstack/react-router";
import {
	BasePageComponent,
	BasePageLoadingSkeleton,
} from "@/components/ui/base-page";
import { ProtectedPage } from "@/components/ui/protected-page";
import { PaymentsTable } from "@/features/payments/components/payment-table";
import { useFilters } from "@/hooks/use-filters";
import { requirePermission } from "@/lib/permissions/permissions";
import { searchValidateSchema } from "@/lib/schema-rules";

export const Route = createFileRoute("/app/payments/")({
	beforeLoad: async () => {
		await requirePermission("payments:view");
	},
	component: RouteComponent,
	validateSearch: searchValidateSchema,
	head: () => ({
		meta: [{ title: "Payments / Prime Age Beauty & Fitness Club" }],
	}),
	pendingComponent: BasePageLoadingSkeleton,
});

function RouteComponent() {
	const { filters, setFilters } = useFilters(Route.id);
	return (
		<ProtectedPage permissions={["payments:view"]}>
			<BasePageComponent
				pageTitle="Payments"
				pageDescription="View and manage payments"
				hasNewButtonLink
				newButtonLinkPath="/app/payments/new"
				createPermissions={["payments:create"]}
				defaultSearchValue={filters.q}
				onSearch={(val) => setFilters({ q: val })}
				buttonText="Add Payment"
			>
				<PaymentsTable />
			</BasePageComponent>
		</ProtectedPage>
	);
}
