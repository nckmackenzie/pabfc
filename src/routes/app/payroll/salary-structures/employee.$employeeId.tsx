import { createFileRoute } from "@tanstack/react-router";
import { BackLink } from "@/components/ui/links";
import { SalaryStructureEmployeeHistory } from "@/features/payroll/components/salary-structure-employee-history";
import { salaryStructureQueries } from "@/features/payroll/services/queries";
import { seo } from "@/lib/helpers";
import { requirePermission } from "@/lib/permissions/permissions";

export const Route = createFileRoute(
	"/app/payroll/salary-structures/employee/$employeeId",
)({
	component: RouteComponent,
	beforeLoad: async () => {
		await requirePermission("employees:payroll-information");
		await requirePermission("salary-structures:view");
	},
	loader: async ({ context: { queryClient }, params }) => {
		const employee = await queryClient.ensureQueryData(
			salaryStructureQueries.employeeSummary({ employeeId: params.employeeId }),
		);
		const history = await queryClient.ensureQueryData(
			salaryStructureQueries.history({ employeeId: params.employeeId }),
		);

		return { employee, history };
	},
	head: () => ({ meta: seo({ title: "Salary History" }) }),
	staticData: {
		breadcrumb: "Salary History",
	},
});

function RouteComponent() {
	const { employee, history } = Route.useLoaderData();

	return (
		<div className="space-y-6">
			<BackLink href="/app/payroll/salary-structures">
				Back to Salary Structures
			</BackLink>
			<SalaryStructureEmployeeHistory employee={employee} history={history} />
		</div>
	);
}
