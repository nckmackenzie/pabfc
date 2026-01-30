import { createFileRoute, notFound } from "@tanstack/react-router";
import { FormLoader } from "@/components/ui/loaders";
import { ProtectedPageWithWrapper } from "@/components/ui/protected-page-with-wrapper";
import { PlanForm } from "@/features/plans/components/plan-form";
import { planQueries } from "@/features/plans/services/queries";
import { requirePermission } from "@/lib/permissions/permissions";
import { toTitleCase } from "@/lib/utils";

export const Route = createFileRoute("/app/plans/$planId/edit")({
	beforeLoad: async () => {
		await requirePermission("plans:update");
	},
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "Edit Plan/Package / Prime Age Beauty & Fitness Center" }],
	}),
	loader: async ({ params, context: { queryClient } }) => {
		const plan = await queryClient.ensureQueryData(
			planQueries.detail(params.planId),
		);
		if (!plan) {
			throw notFound();
		}
		return plan;
	},
	pendingComponent: FormLoader,
	staticData: {
		breadcrumb: (match) => `Edit ${toTitleCase(match.loaderData.plan.name)}`,
	},
});

function RouteComponent() {
	const plan = Route.useLoaderData();
	return (
		<ProtectedPageWithWrapper
			buttonText="Plans List"
			permissions={["plans:update"]}
			hasBackLink
			backPath="/app/plans"
		>
			<PlanForm
				plan={{
					...plan,
					revenueAccountId: plan.revenueAccountId?.toString() ?? "",
				}}
			/>
		</ProtectedPageWithWrapper>
	);
}
