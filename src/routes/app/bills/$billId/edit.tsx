import { createFileRoute } from "@tanstack/react-router";
import { FormLoader } from "@/components/ui/loaders";
import { ProtectedPageWithWrapper } from "@/components/ui/protected-page-with-wrapper";
import { BillForm } from "@/features/bills/components/bill-form";
import { getBillFormValues } from "@/features/bills/lib/utils";
import {
	billQueries,
	supplierQueries,
} from "@/features/bills/services/queries";
import { accountQueries } from "@/features/coa/services/queries";

export const Route = createFileRoute("/app/bills/$billId/edit")({
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "Edit Bill / Prime Age Beauty & Fitness Centre" }],
	}),
	loader: async ({ context: { queryClient }, params: { billId } }) => {
		const [vendors, accounts, bill] = await Promise.all([
			queryClient.ensureQueryData(supplierQueries.active()),
			queryClient.ensureQueryData(
				accountQueries.activeChildAccountsByAccountType("expense"),
			),
			queryClient.ensureQueryData(billQueries.detail(billId)),
		]);

		return {
			vendors,
			accounts,
			bill,
		};
	},
	staticData: {
		breadcrumb: (match) => `Edit Bill ${match.loaderData.bill?.invoiceNo}`,
	},
	pendingComponent: FormLoader,
});

function RouteComponent() {
	const { vendors, accounts, bill } = Route.useLoaderData();
	return (
		<ProtectedPageWithWrapper
			buttonText="Back to bills"
			backPath="/app/bills"
			hasBackLink
			permissions={["bills:create"]}
		>
			<BillForm
				bill={getBillFormValues(bill)}
				loaderAccounts={accounts}
				loaderVendors={vendors}
				isEdit
			/>
		</ProtectedPageWithWrapper>
	);
}
