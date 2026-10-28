import { assertCan } from "@/lib/permissions/can";
import { createFileRoute } from "@tanstack/react-router";
import { FormLoader } from "@/components/ui/loaders";
import { ProtectedPageWithWrapper } from "@/components/ui/protected-page-with-wrapper";
import { PlanForm } from "@/features/plans/components/plan-form";

export const Route = createFileRoute("/app/plans/new")({
	beforeLoad: ({ context }) => {
		assertCan(context.auth, "plans:create");
	},
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "New Plan / Prime Age Beauty & Fitness Center" }],
	}),
	pendingComponent: FormLoader,
	staticData: {
		breadcrumb: "New Plan",
	},
});

function RouteComponent() {
	return (
		<ProtectedPageWithWrapper
			buttonText="Plans List"
			permissions={["plans:create"]}
			hasBackLink
			backPath="/app/plans"
		>
			<PlanForm />
		</ProtectedPageWithWrapper>
	);
}
