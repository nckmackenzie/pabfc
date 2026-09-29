import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui/page-header";
import { ProtectedPageWithWrapper } from "@/components/ui/protected-page-with-wrapper";
import { bankQueries } from "@/features/bankings/services/queries";
import { accountQueries } from "@/features/coa/services/queries";
import {
	CorrectionForm,
	CorrectionFormPendingComponent,
} from "@/features/wht-corrections/components/correction-form";
import { correctionQueries } from "@/features/wht-corrections/services/queries";
import { requirePermission } from "@/lib/permissions/permissions";
import { transformOptions } from "@/lib/utils";

export const Route = createFileRoute("/app/wht-corrections/new")({
	beforeLoad: async () => {
		await requirePermission("wht-corrections:create");
	},
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "New WHT Correction / Prime Age Beauty & Fitness Club" }],
	}),
	pendingComponent: CorrectionFormPendingComponent,
	loader: async ({ context: { queryClient } }) => {
		const [correctionNo, banks, cashEquivalentAccounts, treatmentAccounts] =
			await Promise.all([
				queryClient.ensureQueryData(correctionQueries.correctionNo()),
				queryClient.ensureQueryData(bankQueries.list()),
				queryClient.ensureQueryData(
					accountQueries.childrenAccountsByParentName(
						"Cash And Cash Equivalents",
					),
				),
				queryClient.ensureQueryData(
					accountQueries.activePostingAccountsByAccountType([
						"expense",
						"asset",
					]),
				),
			]);

		return {
			correctionNo,
			banks: transformOptions(banks, "id", "bankName"),
			cashEquivalentAccounts: transformOptions(cashEquivalentAccounts),
			treatmentAccounts,
		};
	},
	staticData: {
		breadcrumb: "New WHT Correction",
	},
});

function RouteComponent() {
	const { correctionNo, banks, cashEquivalentAccounts, treatmentAccounts } =
		Route.useLoaderData();

	return (
		<ProtectedPageWithWrapper
			hasBackLink
			backPath="/app/wht-corrections"
			buttonText="Corrections List"
			permissions={["wht-corrections:create"]}
		>
			<PageHeader
				title="New WHT Correction"
				description="Record a missed withholding tax catch-up against one or more posted bills."
			/>

			<CorrectionForm
				correctionNo={correctionNo.toString()}
				banks={banks}
				cashEquivalentAccounts={cashEquivalentAccounts}
				treatmentAccounts={treatmentAccounts}
			/>
		</ProtectedPageWithWrapper>
	);
}
