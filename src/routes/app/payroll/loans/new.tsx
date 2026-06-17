import { createFileRoute } from "@tanstack/react-router";
import { BackLink } from "@/components/ui/links";
import { LoanApplicationForm } from "@/features/payroll/components/loan-application-form";
import { loanQueries } from "@/features/payroll/services/queries";
import { loanApplicationPrefillSearchSchema } from "@/features/payroll/services/loan.schemas";
import { seo } from "@/lib/helpers";
import { requirePermission } from "@/lib/permissions/permissions";

export const Route = createFileRoute("/app/payroll/loans/new")({
	component: RouteComponent,
	validateSearch: loanApplicationPrefillSearchSchema,
	beforeLoad: async () => {
		await requirePermission("employees:payroll-information");
		await requirePermission("employee-loans:create");
	},
	loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(loanQueries.formOptions()),
	head: () => ({ meta: seo({ title: "Apply For Employee Loan" }) }),
	staticData: {
		breadcrumb: "Apply For Loan",
	},
});

function RouteComponent() {
	const options = Route.useLoaderData();
	const search = Route.useSearch();

	return (
		<div className="space-y-6">
			<BackLink href="/app/payroll/loans">Back to Employee Loans</BackLink>
			<LoanApplicationForm
				options={options}
				preselectedEmployeeId={search.employeeId || undefined}
			/>
		</div>
	);
}
