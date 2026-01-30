import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AlertErrorComponent } from "@/components/ui/error-component";
import { accountQueries } from "@/features/coa/services/queries";

export const Route = createFileRoute("/app/chart-of-accounts")({
	beforeLoad: async ({ context }) => {
		const parentAccounts = await context.queryClient.ensureQueryData(
			accountQueries.parentAccounts(),
		);
		return { parentAccounts };
	},
	component: RouteComponent,
	errorComponent: ({ error }) => (
		<AlertErrorComponent message={error.message} />
	),
	staticData: {
		breadcrumb: "Chart of Accounts",
	},
});

function RouteComponent() {
	return <Outlet />;
}
