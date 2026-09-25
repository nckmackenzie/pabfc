import { createFileRoute, Link } from "@tanstack/react-router";
import { BasePageComponent } from "@/components/ui/base-page";
import { PermissionGate } from "@/components/ui/permission-gate";
import { ProtectedPage } from "@/components/ui/protected-page";
import { ChartOfAccountsTable } from "@/features/coa/components/coa-datatable";
import { useFilters } from "@/hooks/use-filters";
import { searchValidateSchema } from "@/lib/schema-rules";
import { requirePermission } from "@/lib/permissions/permissions";
import { Button } from "@/components/ui/button";
import { CogIcon } from "lucide-react";

export const Route = createFileRoute("/app/chart-of-accounts/")({
	beforeLoad: async () => {
		await requirePermission("chart-of-accounts:view");
	},
	component: RouteComponent,
	validateSearch: searchValidateSchema,
	head: () => ({
		meta: [{ title: "Chart of Accounts / Prime Age Beauty & Fitness Center" }],
	}),
});

function RouteComponent() {
	const { filters, setFilters } = useFilters(Route.id);
	return (
		<ProtectedPage permissions={["chart-of-accounts:view"]}>
			<BasePageComponent
				pageTitle="Chart of Accounts"
				pageDescription="Manage your chart of accounts"
				hasNewButtonLink={true}
				newButtonLinkPath={"/app/chart-of-accounts/new"}
				extraActionButtons={
					<PermissionGate permission="ledger-account-mappings:view">
						<Button asChild size="lg" variant="outline">
							<Link to="/app/chart-of-accounts/account-mappings">
								<CogIcon />
								Account Mappings
							</Link>
						</Button>
					</PermissionGate>
				}
				createPermissions={["chart-of-accounts:create"]}
				defaultSearchValue={filters.q}
				onSearch={(val) => setFilters({ q: val })}
			>
				<ChartOfAccountsTable />
			</BasePageComponent>
		</ProtectedPage>
	);
}
