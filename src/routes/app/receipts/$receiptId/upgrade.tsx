import { createFileRoute } from "@tanstack/react-router";
import { FormLoader } from "@/components/ui/loaders";
import { ProtectedPageWithWrapper } from "@/components/ui/protected-page-with-wrapper";
import { UpgradePaymentForm } from "@/features/receipts/components/upgrade-payment-form";
import { paymentsQueries } from "@/features/receipts/services/queries";
import { planQueries } from "@/features/plans/services/queries";
import { requirePermission } from "@/lib/permissions/permissions";
import { toTitleCase } from "@/lib/utils";

export const Route = createFileRoute("/app/receipts/$receiptId/upgrade")({
	beforeLoad: async () => {
		await requirePermission("receipts:top-up");
	},
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "Upgrade Membership / Prime Age Beauty & Fitness Club" }],
	}),
	pendingComponent: FormLoader,
	loader: async ({ context: { queryClient }, params: { receiptId } }) => {
		// getUpgradeContext always resolves (never null) — an ineligible or missing
		// payment comes back as `{ eligible: false, reason }`, which the form renders
		// as an alert rather than a 404, since the reason itself is useful context.
		const [upgradeContext, plans, { taxType }] = await Promise.all([
			queryClient.ensureQueryData(paymentsQueries.upgradeContext(receiptId)),
			queryClient.ensureQueryData(planQueries.list()),
			queryClient.ensureQueryData(paymentsQueries.membershipTaxType()),
		]);

		const currentPlanId = upgradeContext.eligible ? upgradeContext.plan.id : undefined;

		return {
			upgradeContext,
			taxType,
			// Mirrors /app/receipts/new's plan loading; the current plan is excluded
			// here, and further narrowed to duration-eligible plans in the form.
			plans: plans
				.filter(({ active, id }) => active && id !== currentPlanId)
				.map((plan) => ({ ...plan, name: toTitleCase(plan.name) })),
		};
	},
	staticData: {
		breadcrumb: "Upgrade Membership",
	},
});

function RouteComponent() {
	return (
		<ProtectedPageWithWrapper
			hasBackLink
			backPath="/app/receipts"
			buttonText="Receipts List"
			permissions={["receipts:top-up"]}
		>
			<UpgradePaymentForm />
		</ProtectedPageWithWrapper>
	);
}
