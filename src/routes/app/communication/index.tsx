import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundaryWithSuspense } from "@/components/ui/error-boundary-with-suspense";
import { DatatableSkeleton } from "@/components/ui/loaders";
import { ProtectedPage } from "@/components/ui/protected-page";
import { BroadcastArea } from "@/features/communication/components/broadcast-area";
import { Broadcasts } from "@/features/communication/components/broadcasts";
import { TemplateArea } from "@/features/communication/components/template-area";
import { smsTemplateQueries } from "@/features/communication/services/queries";
import { memberQueries } from "@/features/members/services/queries";
import { planQueries } from "@/features/plans/services/queries";
import { requirePermission } from "@/lib/permissions/permissions";

export const Route = createFileRoute("/app/communication/")({
	beforeLoad: async () => {
		await requirePermission("communication:view");
	},
	staticData: {
		breadcrumb: "Communication",
	},
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "Communication / Prime Age Beauty & Fitness Center" }],
	}),
	loader: async ({ context: { queryClient } }) => {
		const [templates, plans, members] = await Promise.all([
			queryClient.ensureQueryData(smsTemplateQueries.list()),
			queryClient.ensureQueryData(planQueries.active()),
			queryClient.ensureQueryData(memberQueries.list({})),
		]);
		return {
			templates,
			plans,
			members,
		};
	},
});

function RouteComponent() {
	return (
		<ProtectedPage permissions={["communication:view"]}>
			<div className="flex flex-col gap-4">
				<div className="grid md:grid-cols-3 gap-4 items-start flex-1">
					<BroadcastArea />
					<TemplateArea />
				</div>
				<ErrorBoundaryWithSuspense
					errorMessage="Failed to load broadcasts"
					loader={<DatatableSkeleton />}
				>
					<Broadcasts />
				</ErrorBoundaryWithSuspense>
			</div>
		</ProtectedPage>
	);
}
