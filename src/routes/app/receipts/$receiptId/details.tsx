import { createFileRoute, notFound } from "@tanstack/react-router";
import { ProtectedPageWithWrapper } from "@/components/ui/protected-page-with-wrapper";
import {
	PaymentDetails,
	PaymentDetailsSkeleton,
} from "@/features/receipts/components/payment-details";
import { paymentsQueries } from "@/features/receipts/services/queries";
import { requirePermission } from "@/lib/permissions/permissions";

export const Route = createFileRoute("/app/receipts/$receiptId/details")({
	beforeLoad: async () => {
		await requirePermission("receipts:view");
	},
	head: () => ({
		meta: [{ title: "Payment Details / Prime Age Beauty & Fitness Club" }],
	}),
	component: RouteComponent,
	pendingComponent: PaymentDetailsSkeleton,
	loader: async ({ context: { queryClient }, params: { receiptId } }) => {
		const payment = await queryClient.ensureQueryData(
			paymentsQueries.detail(receiptId),
		);
		if (!payment) {
			throw notFound();
		}
		return payment;
	},
	staticData: {
		breadcrumb: "Receipt Details",
	},
});

function RouteComponent() {
	return (
		<ProtectedPageWithWrapper
			hasBackLink
			backPath="/app/receipts"
			buttonText="Receipts List"
			permissions={["receipts:view"]}
		>
			<PaymentDetails />
		</ProtectedPageWithWrapper>
	);
}
