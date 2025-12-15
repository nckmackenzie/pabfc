import { createFileRoute } from "@tanstack/react-router";
import { ProtectedPageWithWrapper } from "@/components/ui/protected-page-with-wrapper";
import { PaymentDetails } from "@/features/payments/components/payment-details";

export const Route = createFileRoute("/app/payments/$paymentId/details")({
	head: () => ({
		meta: [{ title: "Payment Details / Prime Age Beauty & Fitness Club" }],
	}),
	component: RouteComponent,
});

function RouteComponent() {
	const { paymentId } = Route.useParams();

	return (
		<ProtectedPageWithWrapper
			hasBackLink
			backPath="/app/payments"
			buttonText="Payments List"
			permissions={["payments:view"]}
		>
			<PaymentDetails paymentId={paymentId} />
		</ProtectedPageWithWrapper>
	);
}
