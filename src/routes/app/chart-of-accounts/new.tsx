import { createFileRoute } from "@tanstack/react-router";
import { ProtectedPageWithWrapper } from "@/components/ui/protected-page-with-wrapper";
import { ChartOfAccountsForm } from "@/features/coa/components/coa-form";

export const Route = createFileRoute("/app/chart-of-accounts/new")({
	component: RouteComponent,
	head: () => ({
		meta: [
			{ title: "New Chart of Account / Prime Age Beauty & Fitness Center" },
		],
	}),
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
