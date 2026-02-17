import { createFileRoute } from "@tanstack/react-router";
import {
	BasePageComponent,
	BasePageLoadingSkeleton,
} from "@/components/ui/base-page";
import { ProtectedPage } from "@/components/ui/protected-page";
import { BankingsDataTable } from "@/features/bankings/components/bankings-datatable";
import { useFilters } from "@/hooks/use-filters";
import { requirePermission } from "@/lib/permissions/permissions";
import { searchValidateSchema } from "@/lib/schema-rules";

export const Route = createFileRoute("/app/bankings/postings/")({
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
	pendingComponent: () => (
		<BasePageLoadingSkeleton
			pageDescription="View and manage bankings"
			pageTitle="Bankings"
		/>
	),
});

function BankingsIndexComponent() {
	const { setFilters, filters } = useFilters(Route.id);
	return (
		<ProtectedPage permissions={["banking:view"]}>
			<BasePageComponent
				pageTitle="Bankings"
				pageDescription="View and manage bankings"
				hasNewButtonLink
				newButtonLinkPath="/app/bankings/postings/new"
				createPermissions={["banking:create"]}
				defaultSearchValue={filters.q}
				onSearch={(val) => setFilters({ q: val })}
				buttonText="Add Bank Posting"
			>
				<BankingsDataTable />
			</BasePageComponent>
		</ProtectedPage>
	);
}
