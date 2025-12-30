import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Suspense, useEffect } from "react";
import z from "zod";
import { Button } from "@/components/ui/button";
import { ErrorBoundaryWithSuspense } from "@/components/ui/error-boundary-with-suspense";
import { DollarSignIcon, Users2Icon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { PermissionGate } from "@/components/ui/permission-gate";
import { Skeleton } from "@/components/ui/skeleton";
import { Wip } from "@/components/ui/wip";
import { Wrapper } from "@/components/ui/wrapper";
import {
	AverageAttendanceByDays,
	AverageAttendanceByDaysSkeleton,
} from "@/features/dashboard/components/attendance-by-days";
import {
	MembershipsExpiringSoon,
	MembershipsExpiringSoonSkeleton,
} from "@/features/dashboard/components/expiring-soon";
import {
	StatCards,
	StatCardsSkeleton,
} from "@/features/dashboard/components/stat-cards";
import {
	TodaysCheckings,
	TodaysCheckingsSkeleton,
} from "@/features/dashboard/components/todays-checkings";
import { useFilters } from "@/hooks/use-filters";
import { useSession } from "@/lib/auth/client";
import type { Permission } from "@/lib/permissions/constants";
import { getUserPermissions } from "@/lib/permissions/permissions-service";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/dashboard")({
	head: () => ({
		meta: [{ title: "Dashboard / Prime Age Beauty & Fitness Center" }],
	}),
	validateSearch: z.object({
		tab: z.enum(["memberships", "finance"]).optional().catch("memberships"),
	}),
	component: RouteComponent,
});

function RouteComponent() {
	const { data: session } = useSession();
	const queryClient = useQueryClient();
	const { tab } = Route.useSearch();
	useEffect(() => {
		queryClient.prefetchQuery({
			queryKey: ["permissions", session?.user.id],
			queryFn: () => getUserPermissions(),
		});
	}, [queryClient, session?.user.id]);

	return (
		<Wrapper size="full">
			<PageHeader
				title="Dashboard"
				description="Welcome to your dashboard"
				content={<DashboardTabs />}
			/>
			{tab === "finance" ? <Wip /> : <MemberShipDashboard />}
		</Wrapper>
	);
}

const tabs = [
	{
		id: "memberships",
		label: "Memberships",
		icon: Users2Icon,
		permission: "dashboard:view" as Permission,
	},
	{
		id: "finance",
		label: "Finance",
		icon: DollarSignIcon,
		permission: "dashboard:finance" as Permission,
	},
] as const;

function DashboardTabs() {
	const { filters, setFilters } = useFilters(Route.id);
	return (
		<div className="bg-muted text-muted-foreground inline-flex h-9 w-max items-center justify-between rounded-lg p-[3px]">
			{tabs.map((tab) => {
				const Icon = tab.icon;
				const isActive = tab.id === (filters.tab || "memberships");
				return (
					<PermissionGate
						loadingComponent={<Skeleton className="h-8 w-48" />}
						key={tab.id}
						permission={tab.permission}
					>
						<Button
							size="sm"
							onClick={() => setFilters({ tab: tab.id })}
							variant={isActive ? "default" : "ghost"}
							className={cn(
								"grow flex items-center gap-2 px-4 py-2 rounded-md whitespace-nowrap transition-all hover:bg-transparent hover:text-primary",
								{
									"bg-background text-primary": isActive,
								},
							)}
						>
							<Icon />
							<span className="inline text-sm font-medium">
								{tab.label}
							</span>
						</Button>
					</PermissionGate>
				);
			})}
		</div>
	);
}

function MemberShipDashboard() {
	return (
		<>
			<Suspense fallback={<StatCardsSkeleton />}>
				<StatCards />
			</Suspense>
			<div className="grid md:grid-cols-3 gap-6">
				<ErrorBoundaryWithSuspense
					loader={<TodaysCheckingsSkeleton />}
					errorMessage="Failed to load today's checkings"
				>
					<TodaysCheckings />
				</ErrorBoundaryWithSuspense>
				<ErrorBoundaryWithSuspense
					loader={<MembershipsExpiringSoonSkeleton />}
					errorMessage="Failed to load expiring memberships"
				>
					<MembershipsExpiringSoon />
				</ErrorBoundaryWithSuspense>
				<ErrorBoundaryWithSuspense
					loader={<AverageAttendanceByDaysSkeleton />}
					errorMessage="Failed to load attendance chart"
				>
					<AverageAttendanceByDays />
				</ErrorBoundaryWithSuspense>
			</div>
		</>
	);
}
