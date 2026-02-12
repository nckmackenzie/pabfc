import { createFileRoute } from "@tanstack/react-router";
import z from "zod";
import { FormLoader } from "@/components/ui/loaders";
import { ProtectedPageWithWrapper } from "@/components/ui/protected-page-with-wrapper";
import { BillForm } from "@/features/bills/components/bill-form";
import { getBillFormValues } from "@/features/bills/lib/utils";
import {
	billQueries,
	supplierQueries,
} from "@/features/bills/services/queries";
import { accountQueries } from "@/features/coa/services/queries";
import { requirePermission } from "@/lib/permissions/permissions";

export const Route = createFileRoute("/app/bills/new")({
	beforeLoad: async () => {
		await requirePermission("bills:create");
	},
	head: () => ({
		meta: [{ title: "New Bill / Prime Age Beauty & Fitness Centre" }],
	}),
	validateSearch: z.object({
		cloneFrom: z.string().optional(),
	}),
	loaderDeps: ({ search }) => ({ cloneFrom: search.cloneFrom }),
	component: RouteComponent,
	loader: async ({ context: { queryClient }, deps: { cloneFrom } }) => {
		const [vendors, accounts, bill] = await Promise.all([
			queryClient.ensureQueryData(supplierQueries.active()),
			queryClient.ensureQueryData(
				accountQueries.activeChildAccountsByAccountType("expense"),
			),
			cloneFrom
				? queryClient.ensureQueryData(billQueries.detail(cloneFrom))
				: undefined,
		]);
		return {
			vendors,
			accounts,
			bill,
		};
	},
	staticData: {
		breadcrumb: "New Bill",
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
				loaderAccounts={accounts}
				loaderVendors={vendors}
				bill={bill ? getBillFormValues(bill, true) : undefined}
			/>
		</ProtectedPageWithWrapper>
	);
}
