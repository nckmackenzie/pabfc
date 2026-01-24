import { createFileRoute, notFound } from "@tanstack/react-router";
import { ProtectedPageWithWrapper } from "@/components/ui/protected-page-with-wrapper";
import {
	PaymentDetails,
	PaymentDetailsSkeleton,
} from "@/features/payments/components/payment-details";
import { paymentsQueries } from "@/features/payments/services/queries";
import { requirePermission } from "@/lib/permissions/permissions";

export const Route = createFileRoute("/app/payments/$paymentId/details")({
	beforeLoad: async () => {
		await requirePermission("payments:view")
	},
	head: () => ({
		meta: [{ title: "Payment Details / Prime Age Beauty & Fitness Club" }],
	}),
	component: RouteComponent,
	pendingComponent: PaymentDetailsSkeleton,
	loader: async ({ context: { queryClient }, params: { paymentId } }) => {
		const payment = await queryClient.ensureQueryData(
			paymentsQueries.detail(paymentId),
		);
		if (!payment) {
			throw notFound();
		}
		return payment;
	},
});

function RouteComponent() {
	return (
		<ProtectedPageWithWrapper
			hasBackLink
			backPath="/app/payments"
			buttonText="Payments List"
			permissions={["payments:view"]}
		>
			<PaymentDetails />
		</ProtectedPageWithWrapper>
	);
}
