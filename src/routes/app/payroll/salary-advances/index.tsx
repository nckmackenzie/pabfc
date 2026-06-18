import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { z } from "zod";
import { BasePageLoadingSkeleton } from "@/components/ui/base-page";
import { SalaryAdvancesPage } from "@/features/payroll/components/salary-advances-page";
import { salaryAdvanceQueries } from "@/features/payroll/services/queries";
import { seo } from "@/lib/helpers";
import { requirePermission } from "@/lib/permissions/permissions";

const salaryAdvanceDirectorySearchSchema = z.object({
	view: z.enum(["pending", "active"]).optional().catch("pending"),
	departmentId: z.coerce.number().int().positive().optional().catch(undefined),
	employeeId: z.string().trim().optional().catch(undefined),
});

export const Route = createFileRoute("/app/payroll/salary-advances/")({
	component: RouteComponent,
	validateSearch: salaryAdvanceDirectorySearchSchema,
	beforeLoad: async () => {
		await requirePermission("employees:payroll-information");
		await requirePermission("salary-advances:view");
	},
	loaderDeps: ({ search }) => search,
	loader: async ({ context: { queryClient }, deps: search }) => {
		const formOptions = await queryClient.ensureQueryData(salaryAdvanceQueries.formOptions());

		if (search.view === "active") {
			await queryClient.ensureQueryData(
				salaryAdvanceQueries.active({
					departmentId: search.departmentId,
					employeeId: search.employeeId,
				})
			);
		} else {
			await queryClient.ensureQueryData(salaryAdvanceQueries.pending());
		}

		return formOptions;
	},
	head: () => ({ meta: seo({ title: "Salary Advances" }) }),
	pendingComponent: () => (
		<BasePageLoadingSkeleton
			pageTitle="Salary Advances"
			pageDescription="Manage salary advances and payroll recoveries."
		/>
	),
	staticData: {
		breadcrumb: "Salary Advances",
	},
	search: {
		middlewares: [stripSearchParams({ view: "pending" })],
	},
});

function RouteComponent() {
	const options = Route.useLoaderData();
	return <SalaryAdvancesPage departments={options.departments} employees={options.employees} />;
}
