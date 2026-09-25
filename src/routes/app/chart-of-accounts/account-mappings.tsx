import { createFileRoute } from "@tanstack/react-router";
import { BasePageLoadingSkeleton } from "@/components/ui/base-page";
import { LedgerAccountMappingsPage } from "@/features/coa/components/account-mappings-page";
import { accountMappingQueries } from "@/features/coa/services/queries";
import { requirePermission } from "@/lib/permissions/permissions";

export const Route = createFileRoute("/app/chart-of-accounts/account-mappings")({
	beforeLoad: async () => {
		await requirePermission("ledger-account-mappings:view");
	},
	loader: async ({ context: { queryClient } }) => {
		await Promise.all([
			queryClient.ensureQueryData(accountMappingQueries.list()),
			queryClient.ensureQueryData(accountMappingQueries.accountOptions()),
		]);
	},
	component: LedgerAccountMappingsPage,
	head: () => ({
		meta: [{ title: "Account Mappings / Prime Age Beauty & Fitness Club" }],
	}),
	pendingComponent: () => (
		<BasePageLoadingSkeleton
			pageTitle="Account Mappings"
			pageDescription="Bind each posting role to the ledger account the journal engine should use."
		/>
	),
	staticData: {
		breadcrumb: "Account Mappings",
	},
});
