import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";
import { BasePageLoadingSkeleton } from "@/components/ui/base-page";
import { BackLink } from "@/components/ui/links";
import { getMembers } from "@/features/members/services/members.queries.api";
import { toTitleCase } from "@/lib/utils";

export const Route = createFileRoute("/app/reports/finance")({
	beforeLoad: async () => {
		const members = await getMembers({ data: {} });
		return {
			members: members.map(({ id, fullName }) => ({
				value: id,
				label: toTitleCase(fullName),
			})),
		};
	},
	component: FinanceReportLayout,
	staticData: {
		breadcrumb: "Finance Reports",
	},
	pendingComponent: () => <BasePageLoadingSkeleton />,
});

function FinanceReportLayout() {
	const pathname = useLocation({
		select: (location) => location.pathname,
	});

	const isIndexRoute = pathname === "/app/reports/finance";

	return (
		<div className="space-y-4">
			{!isIndexRoute && (
				<BackLink
					href="/app/reports/finance"
					size="sm"
					variant="ghost"
					className="text-primary 
				pl-0!
				"
				>
					Back to Finance Reports
				</BackLink>
			)}
			<Outlet />
		</div>
	);
}
