import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AlertErrorComponent } from "@/components/ui/error-component";
import { accountQueries } from "@/features/coa/services/queries";

export const Route = createFileRoute("/app/plans")({
	beforeLoad: async ({ context }) => {
		const accounts = await context.queryClient.ensureQueryData(
			accountQueries.list({}),
		);
		return { accounts };
	},
	component: RouteComponent,
	errorComponent: ({ error }) => (
		<AlertErrorComponent message={error.message} />
	),
});

function RouteComponent() {
	return <Outlet />;
}
