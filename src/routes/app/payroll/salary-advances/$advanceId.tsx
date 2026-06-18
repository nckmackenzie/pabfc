import { createFileRoute } from "@tanstack/react-router";
import { BackLink } from "@/components/ui/links";
import { FormLoader } from "@/components/ui/loaders";
import { SalaryAdvanceDetail } from "@/features/payroll/components/salary-advance-detail";
import { salaryAdvanceQueries } from "@/features/payroll/services/queries";
import { seo } from "@/lib/helpers";
import { requirePermission } from "@/lib/permissions/permissions";

export const Route = createFileRoute("/app/payroll/salary-advances/$advanceId")({
	component: RouteComponent,
	beforeLoad: async () => {
		await requirePermission("employees:payroll-information");
		await requirePermission("salary-advances:view");
	},
	loader: async ({ context: { queryClient }, params }) => {
		const advance = await queryClient.ensureQueryData(
			salaryAdvanceQueries.detail({ advanceId: params.advanceId })
		);
		await queryClient.ensureQueryData(
			salaryAdvanceQueries.statement({ advanceId: params.advanceId })
		);
		const formOptions = await queryClient.ensureQueryData(salaryAdvanceQueries.formOptions());
		return { advance, formOptions };
	},
	head: () => ({ meta: seo({ title: "Salary Advance Detail" }) }),
	pendingComponent: FormLoader,
	staticData: {
		breadcrumb: "Salary Advance Detail",
	},
});

function RouteComponent() {
	const params = Route.useParams();
	const formOptions = Route.useLoaderData().formOptions;

	return (
		<div className="space-y-6">
			<BackLink href="/app/payroll/salary-advances">Back to Salary Advances</BackLink>
			<SalaryAdvanceDetail
				formOptions={formOptions}
				initialAdvance={Route.useLoaderData().advance}
				key={params.advanceId}
			/>
		</div>
	);
}
