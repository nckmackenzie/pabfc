import { createFileRoute } from "@tanstack/react-router";
import { BackLink } from "@/components/ui/links";
import { SalaryStructureDetail } from "@/features/payroll/components/salary-structure-detail";
import { salaryStructureQueries } from "@/features/payroll/services/queries";
import { seo } from "@/lib/helpers";
import { requirePermission } from "@/lib/permissions/permissions";

export const Route = createFileRoute("/app/payroll/salary-structures/structure/$structureId")({
	component: RouteComponent,
	beforeLoad: async () => {
		await requirePermission("employees:payroll-information");
		await requirePermission("salary-structures:view");
	},
	loader: async ({ context: { queryClient }, params }) => {
		const structure = await queryClient.ensureQueryData(
			salaryStructureQueries.detail({ structureId: params.structureId })
		);
		const employee = await queryClient.ensureQueryData(
			salaryStructureQueries.employeeSummary({ employeeId: structure.employeeId })
		);

		return { structure, employee };
	},
	head: () => ({ meta: seo({ title: "Salary Structure Detail" }) }),
	staticData: {
		breadcrumb: "Salary Structure Detail",
	},
});

function RouteComponent() {
	const { structure, employee } = Route.useLoaderData();

	return (
		<div className="space-y-6">
			<BackLink href="/app/payroll/salary-structures">Back to Salary Structures</BackLink>
			<SalaryStructureDetail structure={structure} employee={employee} />
		</div>
	);
}
