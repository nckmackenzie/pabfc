import { createFileRoute } from "@tanstack/react-router";
import { BasePageLoadingSkeleton } from "@/components/ui/base-page";
import { StatutoryRatesPage } from "@/features/payroll/components/statutory-rates-page";
import { statutoryRateQueries } from "@/features/payroll/services/queries";
import { seo } from "@/lib/helpers";
import { requirePermission } from "@/lib/permissions/permissions";
import { AlertErrorComponent } from "@/components/ui/error-component";

export const Route = createFileRoute("/app/payroll/statutory-rates")({
	beforeLoad: async () => {
		await requirePermission("employees:payroll-information");
		await requirePermission("statutory-rates:view");
	},
	loader: async ({ context }) => {
		await Promise.all([
			context.queryClient.ensureQueryData(statutoryRateQueries.current()),
			context.queryClient.ensureQueryData(statutoryRateQueries.history({ category: "paye_band" })),
		]);
	},
	component: StatutoryRatesPage,
	head: () => ({ meta: seo({ title: "Statutory Rates" }) }),
	pendingComponent: () => (
		<BasePageLoadingSkeleton
			pageTitle="Statutory Rates"
			pageDescription="Manage effective-dated payroll statutory rates."
		/>
	),
	staticData: {
		breadcrumb: "Statutory Rates",
	},
	errorComponent: ({ error }) => {
		let errorMessage;
		if (error.message.includes("Failed query")) {
			errorMessage = "Failed to load statutory rates. Please try again later.";
		} else {
			errorMessage = "An unexpected error occurred. Please try again.";
		}
		return <AlertErrorComponent message={errorMessage} title="Error" />;
	},
});
