import { createFileRoute } from "@tanstack/react-router";
import { DatatableSkeleton } from "@/components/ui/loaders";
import { PageHeader } from "@/components/ui/page-header";
import { ProtectedPageWithWrapper } from "@/components/ui/protected-page-with-wrapper";
import { Skeleton } from "@/components/ui/skeleton";
import { PlanWithMembers } from "@/features/plans/components/plan-with-members";
import { planQueries } from "@/features/plans/services/queries";
import { searchValidateSchema } from "@/lib/schema-rules";
import { requirePermission } from "@/lib/permissions/permissions";

export const Route = createFileRoute("/app/plans/$planId/view-members")({
	beforeLoad: async () => {
		await requirePermission("plans:view-members")
	},
	validateSearch: searchValidateSchema,
	head: () => ({
		meta: [{ title: "Plan Members / Prime Age Beauty & Fitness Centre" }],
	}),
	loader: async ({ context: { queryClient }, params: { planId } }) =>
		await queryClient.ensureQueryData(planQueries.planWithSummary(planId)),
	component: RouteComponent,
	pendingComponent: PendingComponent,
});

function RouteComponent() {
	return (
		<ProtectedPageWithWrapper
			hasBackLink
			backPath="/app/plans"
			buttonText="Back to Plans"
			permissions={["plans:view-members"]}
		>
			<PageHeader title="Plan Members" description="View all members on plan" />
			<PlanWithMembers />
		</ProtectedPageWithWrapper>
	);
}

function PendingComponent() {
	return (
		<ProtectedPageWithWrapper
			hasBackLink
			backPath="/app/plans"
			buttonText="Back to Plans"
			permissions={["plans:view-members"]}
		>
			<PageHeader title="Plan Members" description="View all members on plan" />
			<div className="space-y-6">
				<div className="space-y-4">
					<div className="flex gap-4 flex-col md:flex-row md:items-center md:justify-between">
						<div className="grid gap-1">
							<Skeleton className="h-7 w-48" />
							<Skeleton className="h-4 w-96" />
						</div>
						<div className="flex flex-col md:flex-row md:items-center gap-2">
							<Skeleton className="h-6 w-20" />
							<Skeleton className="h-4 w-32" />
						</div>
					</div>
					<div className="max-w-lg grid grid-cols-2 gap-4">
						<div className="space-y-2">
							<Skeleton className="h-4 w-24" />
							<Skeleton className="h-8 w-16" />
						</div>
						<div className="space-y-2">
							<Skeleton className="h-4 w-24" />
							<Skeleton className="h-8 w-16" />
						</div>
					</div>
				</div>

				<div className="space-y-4 rounded-md p-4 border border-muted">
					<Skeleton className="h-5 w-40" />
					<Skeleton className="h-10 w-full" />
					<DatatableSkeleton />
				</div>
			</div>
		</ProtectedPageWithWrapper>
	);
}
