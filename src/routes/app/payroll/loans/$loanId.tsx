import { createFileRoute } from "@tanstack/react-router";
import { BackLink } from "@/components/ui/links";
import { FormLoader } from "@/components/ui/loaders";
import { LoanDetail } from "@/features/payroll/components/loan-detail";
import { loanQueries } from "@/features/payroll/services/queries";
import { seo } from "@/lib/helpers";
import { requirePermission } from "@/lib/permissions/permissions";

export const Route = createFileRoute("/app/payroll/loans/$loanId")({
	component: RouteComponent,
	beforeLoad: async () => {
		await requirePermission("employees:payroll-information");
		await requirePermission("employee-loans:view");
	},
	loader: async ({ context: { queryClient }, params }) => {
		const loan = await queryClient.ensureQueryData(loanQueries.detail({ loanId: params.loanId }));
		const formOptions = await queryClient.ensureQueryData(loanQueries.formOptions());
		return { loan, formOptions };
	},
	head: () => ({ meta: seo({ title: "Employee Loan Detail" }) }),
	pendingComponent: FormLoader,
	staticData: {
		breadcrumb: "Loan Detail",
	},
});

function RouteComponent() {
	const params = Route.useParams();
	const formOptions = Route.useLoaderData().formOptions;

	return (
		<div className="space-y-6">
			<BackLink href="/app/payroll/loans">Back to Employee Loans</BackLink>
			<LoanDetail
				initialLoan={Route.useLoaderData().loan}
				formOptions={formOptions}
				key={params.loanId}
			/>
		</div>
	);
}
