import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AlertErrorComponent } from "@/components/ui/error-component";
import { accountQueries } from "@/features/coa/services/queries";
import { lateUpgradeGraceDaysDefaultQuery } from "@/features/settings/services/queries";

export const Route = createFileRoute("/app/plans")({
	beforeLoad: async ({ context }) => {
		const [accounts, lateUpgradeGraceDaysDefault] = await Promise.all([
			context.queryClient.ensureQueryData(accountQueries.list({})),
			context.queryClient.ensureQueryData(lateUpgradeGraceDaysDefaultQuery()),
		]);
		return { accounts, lateUpgradeGraceDaysDefault };
	},
	component: RouteComponent,
	staticData: {
		breadcrumb: "Plans List",
	},
	errorComponent: ({ error }) => (
		<AlertErrorComponent message={error.message} />
	),
});

function RouteComponent() {
	return <Outlet />;
}
