import { createFileRoute } from "@tanstack/react-router";
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
	loader: async ({ context: { queryClient } }) => {
		const [members, plans] = await Promise.all([
			queryClient.ensureQueryData(memberQueries.activeMembers()),
			queryClient.ensureQueryData(planQueries.active()),
		]);
		return {
			members: members.map(({ id, fullName }) => ({
				value: id,
				label: toTitleCase(fullName),
			})),
			plans,
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
