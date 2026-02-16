import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { PageHeader } from "@/components/ui/page-header";
import { ProtectedPageWithWrapper } from "@/components/ui/protected-page-with-wrapper";
import { bankQueries } from "@/features/bankings/services/queries";
import {
	billQueries,
	supplierQueries,
} from "@/features/bills/services/queries";
import { accountQueries } from "@/features/coa/services/queries";
import {
	PaymentForm,
	PaymentFormPendingComponent,
} from "@/features/payments/components/payment-form";
import { paymentQueries } from "@/features/payments/services/queries";
import { requirePermission } from "@/lib/permissions/permissions";
import { transformOptions } from "@/lib/utils";
import type { Option } from "@/types/index.types";

export const Route = createFileRoute("/app/payments/new")({
	beforeLoad: async () => {
		await requirePermission("payments:create");
	},
	validateSearch: z.object({
		billId: z.string().optional(),
	}),
	loaderDeps: ({ search }) => ({ billId: search.billId }),
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "New Payment / Prime Age Beauty & Fitness Club" }],
	}),
	pendingComponent: PaymentFormPendingComponent,
	loader: async ({ context: { queryClient }, deps: { billId } }) => {
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

		const singleVendor: Array<Option> = [];
		if (billId) {
			const bill = await queryClient.ensureQueryData(
				billQueries.detail(billId),
			);
			const vendor = await queryClient.ensureQueryData(
				supplierQueries.detail(bill.vendorId),
			);
			singleVendor.push({
				value: vendor.id,
				label: vendor.name,
			});
		}

		return {
			vendors: billId ? singleVendor : vendors,
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
	const { billId } = Route.useSearch();

	// useEffect(() => {
	// 	if (!billId) return;
	// 	queryClient.fetchQuery(billQueries.detail(billId)).then((bill) => {
	// 		setBill({
	// 			vendorId: bill.vendorId,
	// 			paymentMethod: "cheque",
	// 			paymentDate: dateFormat(new Date()),
	// 			reference: "",
	// 			paymentNo: paymentNo.toString(),
	// 			bills: [
	// 				{
	// 					billId: bill.id,
	// 					amount: parseFloat(bill.total),
	// 					balance: parseFloat(bill.total),
	// 					invoiceDate: dateFormat(bill.invoiceDate),
	// 					selected: true,
	// 					invoiceNo: bill.invoiceNo,
	// 					total: parseFloat(bill.total),
	// 					dueDate: bill.dueDate ? dateFormat(bill.dueDate) : null,
	// 				},
	// 			],
	// 		});
	// 	});
	// }, [billId, queryClient, paymentNo]);

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
				billId={billId}
			/>
		</ProtectedPageWithWrapper>
	);
}
