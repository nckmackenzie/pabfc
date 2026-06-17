import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { FormLoader } from "@/components/ui/loaders";
import { BackLink } from "@/components/ui/links";
import { OvertimeRecordForm } from "@/features/payroll/components/overtime-record-form";
import { overtimeQueries } from "@/features/payroll/services/queries";
import { seo } from "@/lib/helpers";
import { requirePermission } from "@/lib/permissions/permissions";

const overtimeCreateSearchSchema = z.object({
	employeeId: z.string().optional().catch(""),
});

export const Route = createFileRoute("/app/payroll/overtime/new")({
	component: RouteComponent,
	validateSearch: overtimeCreateSearchSchema,
	beforeLoad: async () => {
		await requirePermission("employees:payroll-information");
		await requirePermission("overtime-records:create");
	},
	loader: ({ context: { queryClient } }) =>
		queryClient.ensureQueryData(overtimeQueries.formOptions()),
	head: () => ({ meta: seo({ title: "Add Overtime Record" }) }),
	pendingComponent: FormLoader,
	staticData: {
		breadcrumb: "Add Overtime Record",
	},
});

function RouteComponent() {
	const options = Route.useLoaderData();
	const search = Route.useSearch();

	return (
		<div className="space-y-6">
			<BackLink href="/app/payroll/overtime">Back to Overtime Records</BackLink>
			<OvertimeRecordForm
				options={options}
				preselectedEmployeeId={search.employeeId || undefined}
			/>
		</div>
	);
}
