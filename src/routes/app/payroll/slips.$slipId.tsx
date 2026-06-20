import { createFileRoute } from "@tanstack/react-router";
import { BasePageLoadingSkeleton } from "@/components/ui/base-page";
import { PayrollSlipDetailPage } from "@/features/payroll/components/payroll-slip-detail-page";
import { payrollPeriodQueries, payrollSlipQueries } from "@/features/payroll/services/queries";
import { seo } from "@/lib/helpers";
import { requirePermission } from "@/lib/permissions/permissions";

export const Route = createFileRoute("/app/payroll/slips/$slipId")({
	component: PayrollSlipDetailPage,
	beforeLoad: async () => {
		await requirePermission("employees:payroll-information");
		await requirePermission("payroll-periods:view");
	},
	loader: async ({ context: { queryClient }, params: { slipId } }) => {
		const slip = await queryClient.ensureQueryData(payrollSlipQueries.detail({ slipId }));
		await Promise.all([
			queryClient.ensureQueryData(
				payrollPeriodQueries.detail({ periodId: slip.payrollPeriodId })
			),
			queryClient.ensureQueryData(
				payrollSlipQueries.history({ employeeId: slip.employeeId })
			),
		]);
	},
	head: () => ({ meta: seo({ title: "Payroll Slip Detail" }) }),
	pendingComponent: () => (
		<BasePageLoadingSkeleton
			pageTitle="Payroll Slip Detail"
			pageDescription="Loading payroll slip details."
		/>
	),
	staticData: {
		breadcrumb: "Payroll Slip Detail",
	},
});
