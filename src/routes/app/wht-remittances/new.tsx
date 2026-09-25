import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui/page-header";
import { ProtectedPageWithWrapper } from "@/components/ui/protected-page-with-wrapper";
import { bankQueries } from "@/features/bankings/services/queries";
import { accountQueries } from "@/features/coa/services/queries";
import {
	RemittanceForm,
	RemittanceFormPendingComponent,
} from "@/features/wht-remittances/components/remittance-form";
import { remittanceQueries } from "@/features/wht-remittances/services/queries";
import { requirePermission } from "@/lib/permissions/permissions";
import { transformOptions } from "@/lib/utils";

export const Route = createFileRoute("/app/wht-remittances/new")({
	beforeLoad: async () => {
		await requirePermission("wht-remittances:create");
	},
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "New WHT Remittance / Prime Age Beauty & Fitness Club" }],
	}),
	pendingComponent: RemittanceFormPendingComponent,
	loader: async ({ context: { queryClient } }) => {
		const [remittanceNo, banks, cashEquivalentAccounts] = await Promise.all([
			queryClient.ensureQueryData(remittanceQueries.remittanceNo()),
			queryClient.ensureQueryData(bankQueries.list()),
			queryClient.ensureQueryData(
				accountQueries.childrenAccountsByParentName(
					"Cash And Cash Equivalents",
				),
			),
		]);

		return {
			remittanceNo,
			banks: transformOptions(banks, "id", "bankName"),
			cashEquivalentAccounts: transformOptions(cashEquivalentAccounts),
		};
	},
	staticData: {
		breadcrumb: "New WHT Remittance",
	},
});

function RouteComponent() {
	const { remittanceNo, banks, cashEquivalentAccounts } =
		Route.useLoaderData();

	return (
		<ProtectedPageWithWrapper
			hasBackLink
			backPath="/app/wht-remittances"
			buttonText="Remittances List"
			permissions={["wht-remittances:create"]}
		>
			<PageHeader
				title="New WHT Remittance"
				description="Remit withholding tax deducted on bills to KRA."
			/>

			<RemittanceForm
				remittanceNo={remittanceNo.toString()}
				banks={banks}
				cashEquivalentAccounts={cashEquivalentAccounts}
			/>
		</ProtectedPageWithWrapper>
	);
}
