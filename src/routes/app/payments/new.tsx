import { createFileRoute } from "@tanstack/react-router";
import { FormLoader } from "@/components/ui/loaders";
import { ProtectedPageWithWrapper } from "@/components/ui/protected-page-with-wrapper";
import { memberQueries } from "@/features/members/services/queries";
import { PaymentForm } from "@/features/payments/components/payments-form";
import { planQueries } from "@/features/plans/services/queries";
import { toTitleCase } from "@/lib/utils";

export const Route = createFileRoute("/app/payments/new")({
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
