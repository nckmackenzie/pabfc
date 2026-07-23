import { createFileRoute } from "@tanstack/react-router";
import { FormLoader } from "@/components/ui/loaders";
import { ProtectedPageWithWrapper } from "@/components/ui/protected-page-with-wrapper";
import { IssueCreditNoteForm } from "@/features/credit-notes/components/issue-credit-note-form";
import { requirePermission } from "@/lib/permissions/permissions";

export const Route = createFileRoute("/app/credit-notes/new")({
	beforeLoad: async () => {
		await requirePermission("credit-notes:create");
	},
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "Issue Credit Note / Prime Age Beauty & Fitness Club" }],
	}),
	pendingComponent: FormLoader,
	staticData: {
		breadcrumb: "Issue Credit Note",
	},
});

function RouteComponent() {
	return (
		<ProtectedPageWithWrapper
			hasBackLink
			backPath="/app/credit-notes"
			buttonText="Credit Notes List"
			permissions={["credit-notes:create"]}
		>
			<IssueCreditNoteForm />
		</ProtectedPageWithWrapper>
	);
}
