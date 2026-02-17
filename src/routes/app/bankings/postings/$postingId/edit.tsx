import { createFileRoute } from "@tanstack/react-router";
import { FormLoader } from "@/components/ui/loaders";
import { ProtectedPageWithWrapper } from "@/components/ui/protected-page-with-wrapper";
import { BankPostingForm } from "@/features/bankings/components/bank-posting-form";
import { getBankPosting } from "@/features/bankings/services/bankings.api";
import { accountQueries } from "@/features/coa/services/queries";
import { requirePermission } from "@/lib/permissions/permissions";
import { toTitleCase } from "@/lib/utils";

export const Route = createFileRoute("/app/bankings/postings/$postingId/edit")({
	beforeLoad: async () => {
		await requirePermission("banking:update");
	},
	component: RouteComponent,
	pendingComponent: FormLoader,
	staticData: {
		breadcrumb: "Edit Posting",
	},
	head: () => ({
		meta: [
			{
				title: "Edit Bank Posting / Prime Age Beauty & Fitness Center",
			},
		],
	}),
	loader: async ({ params: { postingId }, context: { queryClient } }) => {
		const [posting, accounts] = await Promise.all([
			getBankPosting({ data: postingId }),
			queryClient.ensureQueryData(accountQueries.list({})),
		]);
		return {
			posting,
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
	const { posting, accounts } = Route.useLoaderData();
	return (
		<ProtectedPageWithWrapper
			hasBackLink
			backPath="/app/bankings/postings"
			buttonText="Back to postings"
			permissions={["banking:create"]}
			size="md"
		>
			<BankPostingForm
				posting={{
					id: posting.id,
					amount: parseFloat(posting.amount),
					bankId: posting.bankId,
					narration: toTitleCase(posting.narration ?? ""),
					reference: posting.reference.toUpperCase(),
					transactionDate: posting.transactionDate,
					counterAccountId: posting.counterAccountId?.toString() ?? "",
					direction: posting.dc,
				}}
				accounts={accounts}
			/>
		</ProtectedPageWithWrapper>
	);
}
