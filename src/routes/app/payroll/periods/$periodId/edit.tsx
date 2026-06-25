import { BackLink } from "@/components/ui/links";
import { PayrollPeriodForm } from "@/features/payroll/components/payroll-period/payroll-period-form";
import { PAYROLL_PERIOD_STATUS } from "@/features/payroll/lib/payroll-constants";
import type { PayrollPeriodCreatePayload } from "@/features/payroll/lib/payroll-period/types";
import { payrollPeriodQueries } from "@/features/payroll/services/queries";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/app/payroll/periods/$periodId/edit")({
	component: RouteComponent,
	loader: async ({ context: { queryClient }, params: { periodId } }) => {
		const period = await queryClient.ensureQueryData(payrollPeriodQueries.detail({ periodId }));
		if (period.status !== PAYROLL_PERIOD_STATUS.DRAFT)
			throw new Error("Period must be in draft state to be edited");
		return period;
	},
	staticData: {
		breadcrumb: (b) => `Edit payroll period - ${b.loaderData.name}`,
	},
});

function RouteComponent() {
	const { periodId } = Route.useParams();
	const loaderData = Route.useLoaderData();
	const { data } = useQuery(payrollPeriodQueries.detail({ periodId }));
	const periodData = data || loaderData;
	const period: PayrollPeriodCreatePayload = {
		id: periodData.id,
		payDate: periodData.payDate,
		periodMonth: String(periodData.periodMonth),
		periodYear: periodData.periodYear,
	};
	return (
		<div className="space-y-6">
			<BackLink href="/app/payroll/periods">Back to periods list</BackLink>
			<PayrollPeriodForm periodData={period} />
		</div>
	);
}
