import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { BasePageLoadingSkeleton } from "@/components/ui/base-page";
import { PayrollPeriodsPage } from "@/features/payroll/components/payroll-periods-page";
import { PAYROLL_PERIOD_STATUS_VALUES } from "@/features/payroll/lib/payroll-constants";
import { payrollPeriodQueries } from "@/features/payroll/services/queries";
import { seo } from "@/lib/helpers";
import { requirePermission } from "@/lib/permissions/permissions";

const payrollPeriodsSearchSchema = z.object({
	status: z.enum(PAYROLL_PERIOD_STATUS_VALUES).optional().catch(undefined),
	year: z.coerce.number().int().optional().catch(undefined),
});

export const Route = createFileRoute("/app/payroll/periods")({
	component: PayrollPeriodsPage,
	validateSearch: payrollPeriodsSearchSchema,
	beforeLoad: async () => {
		await requirePermission("employees:payroll-information");
		await requirePermission("payroll-periods:view");
	},
	loaderDeps: ({ search }) => search,
	loader: async ({ context: { queryClient }, deps: search }) => {
		const ytdYear = search.year ?? new Date().getUTCFullYear();
		await Promise.all([
			queryClient.ensureQueryData(
				payrollPeriodQueries.list({
					status: search.status,
					year: search.year,
				})
			),
			queryClient.ensureQueryData(payrollPeriodQueries.active()),
			queryClient.ensureQueryData(payrollPeriodQueries.ytd({ year: ytdYear })),
		]);
	},
	head: () => ({ meta: seo({ title: "Payroll Periods" }) }),
	pendingComponent: () => (
		<BasePageLoadingSkeleton
			pageTitle="Payroll Periods"
			pageDescription="Manage payroll lifecycle periods and compliance deadlines."
		/>
	),
	staticData: {
		breadcrumb: "Payroll Periods",
	},
});
