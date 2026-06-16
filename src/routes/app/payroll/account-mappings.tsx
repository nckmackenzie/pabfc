import { createFileRoute } from "@tanstack/react-router";
import { BasePageLoadingSkeleton } from "@/components/ui/base-page";
import { PayrollAccountMappingsPage } from "@/features/payroll/components/account-mappings-page";
import { payrollAccountMappingQueries } from "@/features/payroll/services/queries";
import { seo } from "@/lib/helpers";
import { requirePermission } from "@/lib/permissions/permissions";

export const Route = createFileRoute("/app/payroll/account-mappings")({
	beforeLoad: async () => {
		await requirePermission("employees:payroll-information");
		await requirePermission("payroll-account-mappings:view");
	},
	loader: async ({ context }) => {
		await Promise.all([
			context.queryClient.ensureQueryData(payrollAccountMappingQueries.list()),
			context.queryClient.ensureQueryData(payrollAccountMappingQueries.accountOptions()),
		]);
	},
	component: PayrollAccountMappingsPage,
	head: () => ({ meta: seo({ title: "Payroll Account Mappings" }) }),
	pendingComponent: () => (
		<BasePageLoadingSkeleton
			pageTitle="Payroll Account Mappings"
			pageDescription="Configure ledger account bindings used during payroll posting."
		/>
	),
	staticData: {
		breadcrumb: "Account Mappings",
	},
});
