import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { z } from "zod";
import { BasePageLoadingSkeleton } from "@/components/ui/base-page";
import { LoansPage } from "@/features/payroll/components/loans-page";
import { loanQueries } from "@/features/payroll/services/queries";
import { loanStatusSchema } from "@/features/payroll/services/loan.schemas";
import { seo } from "@/lib/helpers";
import { requirePermission } from "@/lib/permissions/permissions";

const loanDirectorySearchSchema = z.object({
	q: z.string().optional().catch(""),
	status: loanStatusSchema.optional().catch("all"),
	employeeId: z.string().trim().optional().catch(undefined),
});

export const Route = createFileRoute("/app/payroll/loans/")({
	component: RouteComponent,
	validateSearch: loanDirectorySearchSchema,
	beforeLoad: async () => {
		await requirePermission("employees:payroll-information");
		await requirePermission("employee-loans:view");
	},
	loaderDeps: ({ search }) => search,
	loader: async ({ context: { queryClient }, deps: search }) => {
		const formOptions = await queryClient.ensureQueryData(loanQueries.formOptions());
		await queryClient.ensureQueryData(loanQueries.list(search));
		return formOptions;
	},
	head: () => ({ meta: seo({ title: "Employee Loans" }) }),
	pendingComponent: () => (
		<BasePageLoadingSkeleton
			pageTitle="Employee Loans"
			pageDescription="Manage employee loans and repayments."
		/>
	),
	staticData: {
		breadcrumb: "Employee Loans",
	},
	search: {
		middlewares: [stripSearchParams({ status: "all" })],
	},
});

function RouteComponent() {
	const options = Route.useLoaderData();
	return <LoansPage employees={options.employees} />;
}
