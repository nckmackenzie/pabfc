import { useQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { BackLink } from "@/components/ui/links";
import { EmployeeFormPendingComponent } from "@/features/employees/components/employee-form-skeleton";
import { EmployeeForm } from "@/features/employees/components/employee-form";
import { employeeQueries } from "@/features/employees/services/queries";
import { seo } from "@/lib/helpers";
import { requirePermission } from "@/lib/permissions/permissions";

export const Route = createFileRoute("/app/employees/$employeeId/edit")({
	beforeLoad: async () => {
		await requirePermission("employees:update");
	},
	loader: async ({ context: { queryClient }, params: { employeeId } }) => {
		const employee = await queryClient.ensureQueryData(
			employeeQueries.detail(employeeId),
		);

		if (!employee) {
			throw notFound();
		}

		return employee;
	},
	component: RouteComponent,
	head: () => ({ meta: seo({ title: "Edit Employee" }) }),
	pendingComponent: EmployeeFormPendingComponent,
	staticData: {
		breadcrumb: (match) =>
			`Edit ${match.loaderData.firstName} ${match.loaderData.lastName}`,
	},
});

function RouteComponent() {
	const loaderEmployee = Route.useLoaderData();
	const { employeeId } = Route.useParams();
	const { data: queryEmployee } = useQuery(employeeQueries.detail(employeeId));
	const employee = queryEmployee ?? loaderEmployee;

	return (
		<div className="space-y-6">
			<BackLink href="/app/employees">Back to Employees</BackLink>
			<EmployeeForm employee={employee} />
		</div>
	);
}
