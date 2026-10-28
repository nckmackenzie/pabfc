import { assertCan } from "@/lib/permissions/can";
import { createFileRoute } from "@tanstack/react-router";
import { FormLoader } from "@/components/ui/loaders";
import { ProtectedPageWithWrapper } from "@/components/ui/protected-page-with-wrapper";
import { BankPostingForm } from "@/features/bankings/components/bank-posting-form";
import { getBankPosting } from "@/features/bankings/services/bankings.api";
import { toTitleCase } from "@/lib/utils";

export const Route = createFileRoute("/app/bankings/postings/$postingId/edit")({
	beforeLoad: ({ context }) => {
		assertCan(context.auth, "banking:update");
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
	loader: async ({ params: { postingId } }) => {
		const posting = await getBankPosting({ data: postingId });
		return {
			posting,
		};
	},
});

function RouteComponent() {
	const { posting } = Route.useLoaderData();
	return (
		<ProtectedPageWithWrapper
			hasBackLink
			backPath="/app/bankings/postings"
			buttonText="Back to postings"
			permissions={["banking:update"]}
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
			/>
		</ProtectedPageWithWrapper>
	);
}
