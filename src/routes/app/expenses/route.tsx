import { createFileRoute, Outlet } from "@tanstack/react-router";
import { BasePageLoadingSkeleton } from "@/components/ui/base-page";
import { AlertErrorComponent } from "@/components/ui/error-component";
import { accountQueries } from "@/features/coa/services/queries";
import { payeeQueries } from "@/features/expenses/services/queries";
import { toTitleCase } from "@/lib/utils";

export const Route = createFileRoute("/app/expenses")({
	staticData: {
		breadcrumb: "Expenses List",
	},
	beforeLoad: async ({ context: { queryClient } }) => {
		const [accounts, payees] = await Promise.all([
			queryClient.ensureQueryData(accountQueries.list({})),
			queryClient.ensureQueryData(payeeQueries.list()),
		]);
		return {
			accounts: accounts
				.filter((acc) => acc.isActive && acc.isPosting)
				.map((acc) => ({
					id: acc.id,
					name: toTitleCase(acc.name),
					type: acc.type,
				})),
			payees,
		};
	},
	component: RouteComponent,
	errorComponent: ({ error }) => (
		<AlertErrorComponent message={error.message} />
	),
	pendingComponent: () => <BasePageLoadingSkeleton />,
});

function RouteComponent() {
	return <Outlet />;
}
