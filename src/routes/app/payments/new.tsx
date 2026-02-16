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
import { requirePermission } from "@/lib/permissions/permissions";
import { transformOptions } from "@/lib/utils";

export const Route = createFileRoute("/app/payments/new")({
	beforeLoad: async () => {
		await requirePermission("payments:create");
	},
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "New Payment / Prime Age Beauty & Fitness Club" }],
	}),
	pendingComponent: PaymentFormPendingComponent,
	loader: async ({ context: { queryClient } }) => {
		const [vendors, paymentNo, banks, cashEquivalentAccounts] =
			await Promise.all([
				queryClient.ensureQueryData(supplierQueries.active()),
				queryClient.ensureQueryData(paymentQueries.paymentNo()),
				queryClient.ensureQueryData(bankQueries.list()),
				queryClient.ensureQueryData(
					accountQueries.childrenAccountsByParentName(
						"Cash And Cash Equivalents",
					),
				),
			]);
		return {
			vendors,
			paymentNo,
			banks: transformOptions(banks, "id", "bankName"),
			cashEquivalentAccounts: transformOptions(cashEquivalentAccounts),
		};
	},
	staticData: {
		breadcrumb: "New Payment",
	},
});

function RouteComponent() {
	const { vendors, paymentNo, banks, cashEquivalentAccounts } =
		Route.useLoaderData();
	return (
		<ProtectedPageWithWrapper
			hasBackLink
			backPath="/app/payments"
			buttonText="Payments List"
			permissions={["payments:create"]}
		>
			<PageHeader
				title="New Payment"
				description="Create a new payment. All fields are required."
			/>

			<PaymentForm
				vendors={vendors}
				paymentNo={paymentNo.toString()}
				banks={banks}
				cashEquivalentAccounts={cashEquivalentAccounts}
			/>
		</ProtectedPageWithWrapper>
	);
}
