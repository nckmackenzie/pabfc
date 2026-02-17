import { createFileRoute } from "@tanstack/react-router";
import { FormLoader } from "@/components/ui/loaders";
import { ProtectedPageWithWrapper } from "@/components/ui/protected-page-with-wrapper";
import { BankPostingForm } from "@/features/bankings/components/bank-posting-form";
import { accountQueries } from "@/features/coa/services/queries";
import { requirePermission } from "@/lib/permissions/permissions";
import { toTitleCase } from "@/lib/utils";

export const Route = createFileRoute("/app/bankings/postings/new")({
	component: RouteComponent,
	staticData: {
		breadcrumb: "New Bank Posting",
	},
	head: () => ({
		meta: [{ title: "New Bank Posting / Prime Age Beauty & Fitness Centre" }],
	}),
	pendingComponent: FormLoader,
	beforeLoad: async () => {
		await requirePermission("banking:create");
	},
	loader: async ({ context: { queryClient } }) => {
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
});

function RouteComponent() {
	const { accounts } = Route.useLoaderData();
	return (
		<ProtectedPageWithWrapper
			hasBackLink
			backPath="/app/bankings/postings"
			buttonText="Back to postings"
			permissions={["banking:create"]}
			size="md"
		>
			<BankPostingForm accounts={accounts} />
		</ProtectedPageWithWrapper>
	);
}
