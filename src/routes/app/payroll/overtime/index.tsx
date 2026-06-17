import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { BasePageLoadingSkeleton } from "@/components/ui/base-page";
import { OvertimeRecordsPage } from "@/features/payroll/components/overtime-records-page";
import { overtimeQueries } from "@/features/payroll/services/queries";
import { overtimeStatusSchema } from "@/features/payroll/services/overtime.schemas";
import { seo } from "@/lib/helpers";
import { requirePermission } from "@/lib/permissions/permissions";

const today = new Date();

const overtimePeriodSearchSchema = z.object({
	q: z.string().optional().catch(""),
	periodMonth: z.coerce.number().int().min(1).max(12).catch(today.getUTCMonth() + 1),
	periodYear: z.coerce.number().int().min(2000).max(2100).catch(today.getUTCFullYear()),
	status: overtimeStatusSchema.optional().catch(undefined),
	departmentId: z.coerce.number().int().positive().optional().catch(undefined),
});

export const Route = createFileRoute("/app/payroll/overtime/")({
	component: RouteComponent,
	validateSearch: overtimePeriodSearchSchema,
	beforeLoad: async () => {
		await requirePermission("employees:payroll-information");
		await requirePermission("overtime-records:view");
	},
	loaderDeps: ({ search }) => search,
	loader: async ({ context: { queryClient }, deps: search }) => {
		const formOptions = await queryClient.ensureQueryData(overtimeQueries.formOptions());
		await queryClient.ensureQueryData(overtimeQueries.period(search));
		return formOptions;
	},
	head: () => ({ meta: seo({ title: "Overtime Records" }) }),
	pendingComponent: () => (
		<BasePageLoadingSkeleton
			pageTitle="Overtime Records"
			pageDescription="Manage overtime records for payroll."
		/>
	),
	staticData: {
		breadcrumb: "Overtime Records",
	},
});

function RouteComponent() {
	const options = Route.useLoaderData();

	return <OvertimeRecordsPage departments={options.departments} />;
}
