import { createFileRoute } from "@tanstack/react-router";
import { BasePageComponent } from "@/components/ui/base-page";
import { ProtectedPage } from "@/components/ui/protected-page";
import { CreditNotesTable } from "@/features/credit-notes/components/credit-notes-table";
import { creditNotesSearchValidateSchema } from "@/features/credit-notes/services/schemas";
import { useFilters } from "@/hooks/use-filters";
import { requirePermission } from "@/lib/permissions/permissions";

export const Route = createFileRoute("/app/credit-notes/")({
	beforeLoad: async () => {
		await requirePermission("credit-notes:view");
	},
	component: RouteComponent,
	validateSearch: creditNotesSearchValidateSchema,
	head: () => ({
		meta: [{ title: "Credit Notes / Prime Age Beauty & Fitness Club" }],
	}),
});

function RouteComponent() {
	const { filters, setFilters } = useFilters(Route.id);
	return (
		<ProtectedPage permissions={["credit-notes:view"]}>
			<BasePageComponent
				pageTitle="Credit Notes"
				pageDescription="View and manage member account credit balances"
				hasNewButtonLink
				newButtonLinkPath="/app/credit-notes/new"
				createPermissions={["credit-notes:create"]}
				defaultSearchValue={filters.q}
				onSearch={(val) => setFilters({ q: val })}
				buttonText="Issue Credit Note"
			>
				<CreditNotesTable />
			</BasePageComponent>
		</ProtectedPage>
	);
}
