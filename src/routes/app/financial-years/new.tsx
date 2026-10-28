import { assertCan } from "@/lib/permissions/can";
import { createFileRoute } from "@tanstack/react-router";
import { ProtectedPageWithWrapper } from "@/components/ui/protected-page-with-wrapper";
import { FinancialYearForm } from "@/features/financial-years/components/financial-year-form";

export const Route = createFileRoute("/app/financial-years/new")({
	beforeLoad: ({ context }) => {
		assertCan(context.auth, "financial-years:create");
	},
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "New Financial Year / Prime Age Beauty & Fitness Center" }],
	}),
	staticData: {
		breadcrumb: "New Financial Year",
	},
});

function RouteComponent() {
	return (
		<ProtectedPageWithWrapper
			hasBackLink
			backPath="/app/financial-years"
			buttonText="Financial Years List"
			permissions={["financial-years:create"]}
			size="sm"
		>
			<FinancialYearForm />
		</ProtectedPageWithWrapper>
	);
}
