import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AlertErrorComponent } from "@/components/ui/error-component";
import { accountQueries } from "@/features/coa/services/queries";

export const Route = createFileRoute("/app/plans")({
	beforeLoad: async ({ context, location }) => {
		if (location.pathname === "/app/plans" || location.pathname === "/app/plans/") {
			return { accounts: [] };
		}
		const accounts = await context.queryClient.ensureQueryData(accountQueries.list({}));
		return { accounts };
	},
	component: RouteComponent,
	staticData: {
		breadcrumb: "Plans List",
	},
	errorComponent: ({ error }) => (
		<AlertErrorComponent message={error instanceof Error ? error.message : String(error)} />
	),
});

function RouteComponent() {
	return <Outlet />;
}
