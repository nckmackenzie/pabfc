import { BasePageLoadingSkeleton } from "@/components/ui/base-page";
import { PayrollPeriodDetail } from "@/features/payroll/components/payroll-period/payroll-period-detail";
import { payrollPeriodQueries, payrollSlipQueries } from "@/features/payroll/services/queries";
import { seo } from "@/lib/helpers";
import { requirePermission } from "@/lib/permissions/permissions";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/app/payroll/periods/$periodId/")({
	component: PayrollPeriodDetail,
	beforeLoad: async () => {
		await requirePermission("employees:payroll-information");
		await requirePermission("payroll-periods:view");
	},
	loader: async ({ context: { queryClient }, params: { periodId } }) => {
		await Promise.all([
			queryClient.ensureQueryData(payrollPeriodQueries.detail({ periodId })),
			queryClient.ensureQueryData(payrollSlipQueries.period({ payrollPeriodId: periodId })),
			queryClient.ensureQueryData(
				payrollSlipQueries.departmentSummary({ payrollPeriodId: periodId })
			),
			queryClient.ensureQueryData(
				payrollSlipQueries.adjustmentOptions({ payrollPeriodId: periodId })
			),
		]);
	},
	head: () => ({ meta: seo({ title: "Payroll Period Detail" }) }),
	pendingComponent: () => (
		<BasePageLoadingSkeleton
			pageTitle="Payroll Period Detail"
			pageDescription="Loading payroll period run details."
		/>
	),
	staticData: {
		breadcrumb: "Payroll Period Detail",
	},
});
