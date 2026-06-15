import { createFileRoute } from "@tanstack/react-router";
import { BackLink } from "@/components/ui/links";
import { SalaryStructureForm } from "@/features/payroll/components/salary-structure-form";
import { salaryStructureQueries } from "@/features/payroll/services/queries";
import { salaryStructureCreatePrefillSearchSchema } from "@/features/payroll/services/schemas";
import { seo } from "@/lib/helpers";
import { requirePermission } from "@/lib/permissions/permissions";

export const Route = createFileRoute("/app/payroll/salary-structures/new")({
	component: RouteComponent,
	validateSearch: salaryStructureCreatePrefillSearchSchema,
	beforeLoad: async () => {
		await requirePermission("employees:payroll-information");
		await requirePermission("salary-structures:create");
	},
	loader: ({ context: { queryClient } }) =>
		queryClient.ensureQueryData(salaryStructureQueries.employees()),
	head: () => ({ meta: seo({ title: "Add Salary Structure" }) }),
	staticData: {
		breadcrumb: "Add Salary Structure",
	},
});

function RouteComponent() {
	const employees = Route.useLoaderData();
	const search = Route.useSearch();

	return (
		<div className="space-y-6">
			<BackLink href="/app/payroll/salary-structures">
				Back to Salary Structures
			</BackLink>
			<SalaryStructureForm
				employees={employees}
				preselectedEmployeeId={search.employeeId || undefined}
			/>
		</div>
	);
}
