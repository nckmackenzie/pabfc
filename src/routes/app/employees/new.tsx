import { createFileRoute } from "@tanstack/react-router";
import { BackLink } from "@/components/ui/links";
import { FormLoader } from "@/components/ui/loaders";
import { EmployeeForm } from "@/features/employees/components/employee-form";
import { employeeQueries } from "@/features/employees/services/queries";
import { seo } from "@/lib/helpers";
import { requirePermission } from "@/lib/permissions/permissions";

export const Route = createFileRoute("/app/employees/new")({
	component: RouteComponent,
	beforeLoad: async () => {
		await requirePermission("employees:create");
	},
	loader: ({ context: { queryClient } }) =>
		queryClient.ensureQueryData(employeeQueries.nextEmployeeNo()),
	head: () => ({ meta: seo({ title: "Add New Employee" }) }),
	pendingComponent: FormLoader,
	staticData: {
		breadcrumb: "Add New Employee",
	},
});

function RouteComponent() {
	const employeeNo = Route.useLoaderData();

	return (
		<div className="space-y-6">
			<BackLink href="/app/employees">Back to Employees</BackLink>
			<EmployeeForm generatedEmployeeNo={employeeNo} />
		</div>
	);
}
