import { createFileRoute } from "@tanstack/react-router";
import { BasePageLoadingSkeleton } from "@/components/ui/base-page";
import { PayrollPeriodDetailPage } from "@/features/payroll/components/payroll-period-detail-page";
import { payrollPeriodQueries, payrollSlipQueries } from "@/features/payroll/services/queries";
import { seo } from "@/lib/helpers";
import { requirePermission } from "@/lib/permissions/permissions";

export const Route = createFileRoute("/app/payroll/periods/$periodId")({
	component: PayrollPeriodDetailPage,
	beforeLoad: async () => {
		await requirePermission("employees:payroll-information");
		await requirePermission("payroll-periods:view");
	},
	loader: async ({ context: { queryClient }, params: { periodId } }) => {
		await Promise.all([
			queryClient.ensureQueryData(payrollPeriodQueries.detail({ periodId })),
			queryClient.ensureQueryData(
				payrollSlipQueries.period({ payrollPeriodId: periodId })
			),
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
