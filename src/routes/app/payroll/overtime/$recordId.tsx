import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BackLink } from "@/components/ui/links";
import { FormLoader } from "@/components/ui/loaders";
import { OvertimeRecordDetail } from "@/features/payroll/components/overtime-record-detail";
import { overtimeQueries } from "@/features/payroll/services/queries";
import { seo } from "@/lib/helpers";
import { requirePermission } from "@/lib/permissions/permissions";

export const Route = createFileRoute("/app/payroll/overtime/$recordId")({
	component: RouteComponent,
	beforeLoad: async () => {
		await requirePermission("employees:payroll-information");
		await requirePermission("overtime-records:view");
	},
	loader: ({ context: { queryClient }, params }) =>
		queryClient.ensureQueryData(overtimeQueries.detail({ recordId: params.recordId })),
	head: () => ({ meta: seo({ title: "Overtime Record Detail" }) }),
	pendingComponent: FormLoader,
	staticData: {
		breadcrumb: "Overtime Record Detail",
	},
});

function RouteComponent() {
	const params = Route.useParams();
	const { data } = useSuspenseQuery(overtimeQueries.detail({ recordId: params.recordId }));

	return (
		<div className="space-y-6">
			<BackLink href="/app/payroll/overtime">Back to Overtime Records</BackLink>
			<OvertimeRecordDetail record={data} />
		</div>
	);
}
