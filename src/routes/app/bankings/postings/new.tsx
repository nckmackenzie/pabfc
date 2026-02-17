import { createFileRoute } from "@tanstack/react-router";
import { FormLoader } from "@/components/ui/loaders";
import { ProtectedPageWithWrapper } from "@/components/ui/protected-page-with-wrapper";
import { BankPostingForm } from "@/features/bankings/components/bank-posting-form";
import { requirePermission } from "@/lib/permissions/permissions";

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
});

function RouteComponent() {
	return (
		<ProtectedPageWithWrapper
			hasBackLink
			backPath="/app/bankings/postings"
			buttonText="Back to postings"
			permissions={["banking:create"]}
			size="md"
		>
			<BankPostingForm />
		</ProtectedPageWithWrapper>
	);
}
