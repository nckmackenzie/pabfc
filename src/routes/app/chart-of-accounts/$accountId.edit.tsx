import { createFileRoute, notFound } from "@tanstack/react-router";
import { FormLoader } from "@/components/ui/loaders";
import { ProtectedPageWithWrapper } from "@/components/ui/protected-page-with-wrapper";
import { ChartOfAccountsForm } from "@/features/coa/components/coa-form";
import { accountQueries } from "@/features/coa/services/queries";
import { requirePermission } from "@/lib/permissions/permissions";

export const Route = createFileRoute("/app/chart-of-accounts/$accountId/edit")({
	beforeLoad: async () => {
		await requirePermission("chart-of-accounts:update");
	},
	head: () => ({
		meta: [{ title: "Edit Account / Prime Age Beauty & Fitness Center" }],
	}),
	component: RouteComponent,
	pendingComponent: FormLoader,
	loader: async ({ params, context: { queryClient } }) => {
		const account = await queryClient.ensureQueryData(
			accountQueries.detail(Number(params.accountId)),
		);
		if (!account) {
			throw notFound();
		}
		return { account };
	},
	staticData: {
		breadcrumb: (match) => `Edit ${match.loaderData.account.name}`,
	},
});

function RouteComponent() {
	const { account } = Route.useLoaderData();
	return (
		<ProtectedPageWithWrapper
			size="sm"
			permissions={["chart-of-accounts:update"]}
			hasBackLink
			backPath="/app/chart-of-accounts"
			buttonText="Accounts List"
		>
			<ChartOfAccountsForm
				account={{
					...account,
					isSubcategory: account.isPosting,
					parentId: account.parentId?.toString() || null,
					isBankAccount: !!account.bank?.accountNumber,
					accountNumber: account.bank?.accountNumber || null,
					openingBalance: null,
					openingBalanceDate: null,
				}}
			/>
		</ProtectedPageWithWrapper>
	);
}
