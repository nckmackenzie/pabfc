import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundaryWithSuspense } from "@/components/ui/error-boundary-with-suspense";
import { DatatableSkeleton } from "@/components/ui/loaders";
import { ProtectedPage } from "@/components/ui/protected-page";
import { Skeleton } from "@/components/ui/skeleton";
import { Wrapper } from "@/components/ui/wrapper";
import { BroadcastArea } from "@/features/communication/components/broadcast-area";
import { Broadcasts } from "@/features/communication/components/broadcasts";
import {
	TemplateArea,
	TemplatesSkeleton,
} from "@/features/communication/components/template-area";
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
	pendingComponent: PendingComponent,
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

function PendingComponent() {
	return (
		<ProtectedPage permissions={["communication:view"]}>
			<div className="flex flex-col gap-4">
				<div className="grid md:grid-cols-3 gap-4 items-start flex-1">
					<Wrapper className="col-span-2">
						<div className="flex items-center justify-between mb-6">
							<div className="space-y-1">
								<Skeleton className="h-6 w-32" />
								<Skeleton className="h-3 w-48" />
							</div>
						</div>
						<div className="space-y-4">
							<div className="grid md:grid-cols-2 gap-4">
								<div className="space-y-2">
									<Skeleton className="h-4 w-24" />
									<Skeleton className="h-10 w-full" />
								</div>
								<div className="space-y-2">
									<Skeleton className="h-4 w-24" />
									<Skeleton className="h-10 w-full" />
								</div>
							</div>
							<div className="space-y-2">
								<Skeleton className="h-4 w-24" />
								<Skeleton className="h-10 w-full" />
							</div>
							<div className="space-y-2">
								<Skeleton className="h-4 w-24" />
								<Skeleton className="h-32 w-full" />
							</div>
						</div>
					</Wrapper>
					<Wrapper>
						<div className="flex items-center justify-between mb-4">
							<div className="space-y-1">
								<Skeleton className="h-6 w-24" />
								<Skeleton className="h-3 w-32" />
							</div>
							<Skeleton className="h-8 w-28" />
						</div>
						<TemplatesSkeleton />
					</Wrapper>
				</div>
				<Wrapper className="space-y-4">
					<div className="flex items-center justify-between">
						<div className="space-y-1">
							<Skeleton className="h-6 w-40" />
							<Skeleton className="h-3 w-32" />
						</div>
					</div>
					<DatatableSkeleton />
				</Wrapper>
			</div>
		</ProtectedPage>
	);
}
