import { createFileRoute, Outlet } from "@tanstack/react-router";
import { BasePageLoadingSkeleton } from "@/components/ui/base-page";
import { AlertErrorComponent } from "@/components/ui/error-component";
import { bankQueries } from "@/features/bankings/services/queries";
import { accountQueries } from "@/features/coa/services/queries";
import { payeeQueries } from "@/features/expenses/services/queries";
import { toTitleCase, transformOptions } from "@/lib/utils";

export const Route = createFileRoute("/app/expenses")({
	staticData: {
		breadcrumb: "Expenses List",
	},
	beforeLoad: async ({ context: { queryClient } }) => {
		const [accounts, payees, banks, cashEquivalentAccounts] = await Promise.all(
			[
				queryClient.ensureQueryData(accountQueries.list({})),
				queryClient.ensureQueryData(payeeQueries.list()),
				queryClient.ensureQueryData(bankQueries.list()),
				queryClient.ensureQueryData(
					accountQueries.childrenAccountsByParentName(
						"Cash And Cash Equivalents",
					),
				),
			],
		);
		return {
			accounts: accounts
				.filter(
					(acc) => acc.isActive && acc.isPosting && acc.type === "expense",
				)
				.map((acc) => ({
					id: acc.id,
					name: toTitleCase(acc.name),
					type: acc.type,
				})),
			payees,
			banks: transformOptions(banks, "id", "bankName"),
			cashEquivalentAccounts: transformOptions(cashEquivalentAccounts),
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
