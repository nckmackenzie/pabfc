import { assertCan } from "@/lib/permissions/can";
import { createFileRoute } from "@tanstack/react-router";
import { FormLoader } from "@/components/ui/loaders";
import { ProtectedPageWithWrapper } from "@/components/ui/protected-page-with-wrapper";
import { memberQueries } from "@/features/members/services/queries";
import { planQueries } from "@/features/plans/services/queries";
import { PaymentForm } from "@/features/receipts/components/payments-form";
import { paymentsQueries } from "@/features/receipts/services/queries";
import { toTitleCase } from "@/lib/utils";

export const Route = createFileRoute("/app/receipts/new")({
	beforeLoad: ({ context }) => {
		assertCan(context.auth, "receipts:create");
	},
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "New Receipt / Prime Age Beauty & Fitness Club" }],
	}),
	pendingComponent: FormLoader,
	loader: async ({ context: { queryClient } }) => {
		const [members, plans, { taxType }] = await Promise.all([
			queryClient.ensureQueryData(memberQueries.allMembersValueWithLabel()),
			queryClient.ensureQueryData(planQueries.list()),
			queryClient.ensureQueryData(paymentsQueries.membershipTaxType()),
		]);
		return {
			members,
			taxType,
			plans: plans
				.filter(({ active, isGuestPass }) => active && !isGuestPass)
				.map((plan) => ({ ...plan, name: toTitleCase(plan.name) })),
		};
	},
	staticData: {
		breadcrumb: "New Receipt",
	},
});

function RouteComponent() {
	return (
		<ProtectedPageWithWrapper
			hasBackLink
			backPath="/app/receipts"
			buttonText="Receipts List"
			permissions={["receipts:create"]}
		>
			<PaymentForm />
		</ProtectedPageWithWrapper>
	);
}
