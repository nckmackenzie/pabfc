import { assertCan } from "@/lib/permissions/can";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { ProtectedPageWithWrapper } from "@/components/ui/protected-page-with-wrapper";
import {
	CreditNoteDetails,
	CreditNoteDetailsSkeleton,
} from "@/features/credit-notes/components/credit-note-details";
import { creditNoteQueries } from "@/features/credit-notes/services/queries";

export const Route = createFileRoute("/app/credit-notes/$creditNoteId/details")({
	beforeLoad: ({ context }) => {
		assertCan(context.auth, "credit-notes:view");
	},
	head: () => ({
		meta: [{ title: "Credit Note Details / Prime Age Beauty & Fitness Club" }],
	}),
	component: RouteComponent,
	pendingComponent: CreditNoteDetailsSkeleton,
	loader: async ({ context: { queryClient }, params: { creditNoteId } }) => {
		const creditNote = await queryClient.ensureQueryData(creditNoteQueries.detail(creditNoteId));
		if (!creditNote) {
			throw notFound();
		}
		return creditNote;
	},
	staticData: {
		breadcrumb: "Credit Note Details",
	},
});

function RouteComponent() {
	return (
		<ProtectedPageWithWrapper
			hasBackLink
			backPath="/app/credit-notes"
			buttonText="Credit Notes List"
			permissions={["credit-notes:view"]}
		>
			<CreditNoteDetails />
		</ProtectedPageWithWrapper>
	);
}
