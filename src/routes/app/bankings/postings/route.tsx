import { createFileRoute, Outlet } from "@tanstack/react-router";
import { getBanks } from "@/features/bankings/services/bankings.api";
import { accountQueries } from "@/features/coa/services/queries";
import { toTitleCase } from "@/lib/utils";

export const Route = createFileRoute("/app/bankings/postings")({
	component: RouteComponent,
	beforeLoad: async ({ context: { queryClient } }) => {
		const [banks, accounts] = await Promise.all([
			getBanks(),
			queryClient.ensureQueryData(accountQueries.list({})),
		]);
		return {
			banks,
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
});

function RouteComponent() {
	return <Outlet />;
}
