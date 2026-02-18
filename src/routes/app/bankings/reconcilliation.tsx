import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui/page-header";
import { ProtectedPageWithWrapper } from "@/components/ui/protected-page-with-wrapper";
import { BankReconcilliation } from "@/features/bankings/components/bank-reconciliation";
import { bankReconciliationValidateSearch } from "@/features/bankings/services/schema";
import { requirePermission } from "@/lib/permissions/permissions";

export const Route = createFileRoute("/app/bankings/reconcilliation")({
	component: ReconcilliationComponent,
	beforeLoad: async () => {
		await requirePermission("banking:reconciliation");
	},
	validateSearch: bankReconciliationValidateSearch,
	head: () => ({
		meta: [
			{ title: "Bank Reconciliation / Prime Age Beauty & Fitness Center" },
		],
	}),
	staticData: {
		breadcrumb: "Bank Reconciliation",
	},
});

function ReconcilliationComponent() {
	return (
		<ProtectedPageWithWrapper permissions={["banking:reconciliation"]}>
			<PageHeader
				title="Bank Reconciliation"
				description="Reconcile your bank accounts with the system."
			/>
			<BankReconcilliation />
		</ProtectedPageWithWrapper>
	);
}
