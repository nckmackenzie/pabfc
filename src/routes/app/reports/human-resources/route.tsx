import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";
import { BasePageLoadingSkeleton } from "@/components/ui/base-page";
import { BackLink } from "@/components/ui/links";

export const Route = createFileRoute("/app/reports/human-resources")({
	component: HumanResourcesReportLayout,
	staticData: {
		breadcrumb: "Human Resources Reports",
	},
	pendingComponent: () => <BasePageLoadingSkeleton />,
});

function HumanResourcesReportLayout() {
	const pathname = useLocation({
		select: (location) => location.pathname,
	});

	const isIndexRoute = pathname.replace(/\/+$/, "") === "/app/reports/human-resources";

	return (
		<div className="space-y-4">
			{!isIndexRoute && (
				<BackLink
					href="/app/reports/human-resources"
					size="sm"
					variant="ghost"
					className="text-primary pl-0!"
				>
					Back to Human Resources Reports
				</BackLink>
			)}
			<Outlet />
		</div>
	);
}
