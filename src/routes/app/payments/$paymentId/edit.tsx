import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui/page-header";
import { ProtectedPageWithWrapper } from "@/components/ui/protected-page-with-wrapper";
import { bankQueries } from "@/features/bankings/services/queries";
import { supplierQueries } from "@/features/bills/services/queries";
import { accountQueries } from "@/features/coa/services/queries";
import {
	PaymentForm,
	PaymentFormPendingComponent,
} from "@/features/payments/components/payment-form";
import { paymentQueries } from "@/features/payments/services/queries";
import { transformPaymentFormValues } from "@/features/payments/utils/lib";
import { requirePermission } from "@/lib/permissions/permissions";
import { transformOptions } from "@/lib/utils";
import type { Option } from "@/types/index.types";

export const Route = createFileRoute("/app/payments/$paymentId/edit")({
	beforeLoad: async () => {
		await requirePermission("payments:update");
	},
	head: () => ({
		meta: [{ title: "Edit Payment / Prime Age Beauty & Fitness Center" }],
	}),
	loader: async ({ params, context: { queryClient } }) => {
		const [payment, banks, cashEquivalentAccounts] = await Promise.all([
			queryClient.ensureQueryData(paymentQueries.detail(params.paymentId)),
			queryClient.ensureQueryData(bankQueries.list()),
			queryClient.ensureQueryData(
				accountQueries.childrenAccountsByParentName(
					"Cash And Cash Equivalents",
				),
			),
		]);
		const suppliers: Array<Option> = [];
		const supplier = await queryClient
			.ensureQueryData(supplierQueries.detail(payment.vendor.id))
			.then((data) => ({ value: data.id, label: data.name }));
		suppliers.push(supplier);
		return {
			payment,
			banks: transformOptions(banks, "id", "bankName"),
			cashEquivalentAccounts: transformOptions(cashEquivalentAccounts),
			suppliers,
		};
	},
	staticData: {
		breadcrumb: (match) =>
			`Edit Payment #${match.loaderData.payment.paymentNo}`,
	},
	component: PaymentEdit,
	pendingComponent: PaymentFormPendingComponent,
});

function PaymentEdit() {
	const {
		payment: loaderPayment,
		banks,
		cashEquivalentAccounts,
		suppliers,
	} = Route.useLoaderData();
	const { paymentId } = Route.useParams();
	const { data: freshPayment } = useQuery(paymentQueries.detail(paymentId));
	const payment = freshPayment || loaderPayment;
	return (
		<ProtectedPageWithWrapper
			hasBackLink
			backPath="/app/payments"
			buttonText="Payments List"
			permissions={["payments:update"]}
		>
			<PageHeader title="Edit Payment" description="Edit  payment." />

			<PaymentForm
				vendors={suppliers}
				paymentNo={payment.paymentNo.toString()}
				banks={banks}
				cashEquivalentAccounts={cashEquivalentAccounts}
				payment={transformPaymentFormValues(payment)}
			/>
		</ProtectedPageWithWrapper>
	);
}
