import { createFileRoute } from "@tanstack/react-router";
import { FormLoader } from "@/components/ui/loaders";
import { ProtectedPageWithWrapper } from "@/components/ui/protected-page-with-wrapper";
import { memberQueries } from "@/features/members/services/queries";
import { planQueries } from "@/features/plans/services/queries";
import { PaymentForm } from "@/features/receipts/components/payments-form";
import { requirePermission } from "@/lib/permissions/permissions";
import { toTitleCase } from "@/lib/utils";

export const Route = createFileRoute("/app/payments/new")({
	beforeLoad: async () => {
		await requirePermission("payments:create");
	},
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "New Payment / Prime Age Beauty & Fitness Club" }],
	}),
	pendingComponent: FormLoader,
	loader: async ({ context: { queryClient } }) => {
		const [members, plans] = await Promise.all([
			queryClient.ensureQueryData(memberQueries.activeMembers()),
			queryClient.ensureQueryData(planQueries.list()),
		]);
		return {
			members: members.map(({ id, fullName }) => ({
				value: id,
				label: toTitleCase(fullName),
			})),
			plans: plans
				.filter(({ active }) => active)
				.map((plan) => ({ ...plan, name: toTitleCase(plan.name) })),
		};
	},
	staticData: {
		breadcrumb: "New Payment",
	},
});

function RouteComponent() {
	return (
		<ProtectedPageWithWrapper
			hasBackLink
			backPath="/app/payments"
			buttonText="Payments List"
			permissions={["payments:create"]}
		>
			<PaymentForm />
		</ProtectedPageWithWrapper>
	);
}
