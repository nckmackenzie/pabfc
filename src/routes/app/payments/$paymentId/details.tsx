import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ProtectedPageWithWrapper } from "@/components/ui/protected-page-with-wrapper";
import {
	PaymentDetails,
	PaymentDetailsSkeleton,
} from "@/features/payments/components/payment-details";
import { paymentQueries } from "@/features/payments/services/queries";
import { requirePermission } from "@/lib/permissions/permissions";

export const Route = createFileRoute("/app/payments/$paymentId/details")({
	beforeLoad: async () => {
		await requirePermission("payments:view");
	},
	head: () => ({
		meta: [{ title: "Payment Details / Prime Age Beauty & Fitness Club" }],
	}),
	component: RouteComponent,
	loader: async ({ context: { queryClient }, params: { paymentId } }) => {
		const payment = await queryClient.ensureQueryData(
			paymentQueries.detail(paymentId),
		);

		return payment;
	},
	staticData: {
		breadcrumb: (match) => `Payment #${match.loaderData.paymentNo} Details`,
	},
	pendingComponent: PaymentDetailsSkeleton,
});

function RouteComponent() {
	const { paymentId } = Route.useParams();
	const loaderPayment = Route.useLoaderData();
	const { data: payment } = useQuery(paymentQueries.detail(paymentId));
	return (
		<ProtectedPageWithWrapper
			hasBackLink
			backPath="/app/payments"
			buttonText="Payments List"
			permissions={["payments:view"]}
		>
			<PaymentDetails payment={payment ?? loaderPayment} />
		</ProtectedPageWithWrapper>
	);
}
