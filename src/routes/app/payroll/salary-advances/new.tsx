import { createFileRoute } from "@tanstack/react-router";
import { BackLink } from "@/components/ui/links";
import { SalaryAdvanceApplicationForm } from "@/features/payroll/components/salary-advance-application-form";
import { salaryAdvanceQueries } from "@/features/payroll/services/queries";
import { salaryAdvanceApplicationPrefillSearchSchema } from "@/features/payroll/services/salary-advance.schemas";
import { seo } from "@/lib/helpers";
import { requirePermission } from "@/lib/permissions/permissions";

export const Route = createFileRoute("/app/payroll/salary-advances/new")({
	component: RouteComponent,
	validateSearch: salaryAdvanceApplicationPrefillSearchSchema,
	beforeLoad: async () => {
		await requirePermission("employees:payroll-information");
		await requirePermission("salary-advances:create");
	},
	loader: ({ context: { queryClient } }) =>
		queryClient.ensureQueryData(salaryAdvanceQueries.formOptions()),
	head: () => ({ meta: seo({ title: "Apply For Salary Advance" }) }),
	staticData: {
		breadcrumb: "Apply For Salary Advance",
	},
});

function RouteComponent() {
	const options = Route.useLoaderData();
	const search = Route.useSearch();

	return (
		<div className="space-y-6">
			<BackLink href="/app/payroll/salary-advances">Back to Salary Advances</BackLink>
			<SalaryAdvanceApplicationForm
				options={options}
				preselectedEmployeeId={search.employeeId || undefined}
			/>
		</div>
	);
}
