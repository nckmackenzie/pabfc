import { createFileRoute } from "@tanstack/react-router";
import { BasePageComponent } from "@/components/ui/base-page";
import { ProtectedPage } from "@/components/ui/protected-page";
import { PaymentTable } from "@/features/payments/components/payment-table";
import { paymentsSearchValidateSchema } from "@/features/payments/services/schemas";
import { useFilters } from "@/hooks/use-filters";
import { requirePermission } from "@/lib/permissions/permissions";

export const Route = createFileRoute("/app/payments/")({
	beforeLoad: async () => {
		await requirePermission("payments:view")
	},
	component: RouteComponent,
	validateSearch: paymentsSearchValidateSchema,
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
			>
				<PaymentTable />
			</BasePageComponent>
		</ProtectedPage>
	);
}
