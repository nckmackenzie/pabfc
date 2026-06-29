import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";
import { BasePageLoadingSkeleton } from "@/components/ui/base-page";
import { BackLink } from "@/components/ui/links";
import { requirePermission } from "@/lib/permissions/permissions";

export const Route = createFileRoute("/app/reports/payroll")({
	beforeLoad: async () => {
		await requirePermission("reports:payroll-p9");
		await requirePermission("employees:payroll-information");
		await requirePermission("payroll-periods:view");
	},
	component: PayrollReportLayout,
	staticData: {
		breadcrumb: "Payroll Reports",
	},
	pendingComponent: () => <BasePageLoadingSkeleton />,
});

function PayrollReportLayout() {
	const pathname = useLocation({
		select: (location) => location.pathname,
	});

	const isIndexRoute = pathname.replace(/\/+$/, "") === "/app/reports/payroll";

	return (
		<div className="space-y-4">
			{!isIndexRoute && (
				<BackLink
					href="/app/reports/payroll"
					size="sm"
					variant="ghost"
					className="text-primary pl-0!"
				>
					Back to Payroll Reports
				</BackLink>
			)}
			<Outlet />
		</div>
	);
}
