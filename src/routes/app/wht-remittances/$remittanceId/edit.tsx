import { useQuery } from "@tanstack/react-query";
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
import { transformRemittanceFormValues } from "@/features/wht-remittances/utils/lib";
import { requirePermission } from "@/lib/permissions/permissions";
import { transformOptions } from "@/lib/utils";

export const Route = createFileRoute("/app/wht-remittances/$remittanceId/edit")(
	{
		beforeLoad: async () => {
			await requirePermission("wht-remittances:update");
		},
		head: () => ({
			meta: [
				{ title: "Edit WHT Remittance / Prime Age Beauty & Fitness Club" },
			],
		}),
		loader: async ({ params, context: { queryClient } }) => {
			const [remittance, banks, cashEquivalentAccounts] = await Promise.all([
				queryClient.ensureQueryData(
					remittanceQueries.detail(params.remittanceId),
				),
				queryClient.ensureQueryData(bankQueries.list()),
				queryClient.ensureQueryData(
					accountQueries.childrenAccountsByParentName(
						"Cash And Cash Equivalents",
					),
				),
			]);

			return {
				remittance,
				banks: transformOptions(banks, "id", "bankName"),
				cashEquivalentAccounts: transformOptions(cashEquivalentAccounts),
			};
		},
		staticData: {
			breadcrumb: (match) =>
				`Edit Remittance #${match.loaderData.remittance.remittanceNo}`,
		},
		component: RemittanceEdit,
		pendingComponent: RemittanceFormPendingComponent,
	},
);

function RemittanceEdit() {
	const {
		remittance: loaderRemittance,
		banks,
		cashEquivalentAccounts,
	} = Route.useLoaderData();
	const { remittanceId } = Route.useParams();
	const { data: freshRemittance } = useQuery(
		remittanceQueries.detail(remittanceId),
	);
	const remittance = freshRemittance || loaderRemittance;

	return (
		<ProtectedPageWithWrapper
			hasBackLink
			backPath="/app/wht-remittances"
			buttonText="Remittances List"
			permissions={["wht-remittances:update"]}
		>
			<PageHeader
				title="Edit WHT Remittance"
				description="Edit withholding tax remittance."
			/>

			<RemittanceForm
				remittanceNo={remittance.remittanceNo.toString()}
				banks={banks}
				cashEquivalentAccounts={cashEquivalentAccounts}
				remittance={transformRemittanceFormValues(remittance)}
			/>
		</ProtectedPageWithWrapper>
	);
}
