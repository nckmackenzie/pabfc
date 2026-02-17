import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AlertErrorComponent } from "@/components/ui/error-component";
import { accountQueries } from "@/features/coa/services/queries";
import { toTitleCase } from "@/lib/utils";

export const Route = createFileRoute("/app/bankings/postings")({
	component: RouteComponent,
	beforeLoad: async ({ context: { queryClient } }) => {
		const accounts = await queryClient.ensureQueryData(accountQueries.list({}));
		return {
			accounts: accounts
				.filter((a) => a.isActive && a.isPosting)
				.map(({ id, name }) => ({
					value: id.toString(),
					label: toTitleCase(name),
				})),
		};
	},
	staticData: {
		breadcrumb: "Bank Postings",
	},
	errorComponent: ({ error }) => (
		<AlertErrorComponent message={error.message} />
	),
});

function RouteComponent() {
	return <Outlet />;
}
