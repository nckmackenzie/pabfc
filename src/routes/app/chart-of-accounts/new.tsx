import { createFileRoute } from "@tanstack/react-router";
import { FormLoader } from "@/components/ui/loaders";
import { ProtectedPageWithWrapper } from "@/components/ui/protected-page-with-wrapper";
import { ChartOfAccountsForm } from "@/features/coa/components/coa-form";
import { accountQueries } from "@/features/coa/services/queries";

export const Route = createFileRoute("/app/chart-of-accounts/new")({
	component: RouteComponent,
	head: () => ({
		meta: [
			{ title: "New Chart of Account / Prime Age Beauty & Fitness Center" },
		],
	}),
	pendingComponent: FormLoader,
	loader: async ({ context: { queryClient } }) =>
		await queryClient.ensureQueryData(accountQueries.parentAccounts()),
});

function RouteComponent() {
	return (
		<ProtectedPageWithWrapper
			hasBackLink
			buttonText="Accounts List"
			backPath="/app/chart-of-accounts"
			permissions={["chart-of-accounts:create"]}
			size="xs"
		>
			<ChartOfAccountsForm />
		</ProtectedPageWithWrapper>
	);
}
