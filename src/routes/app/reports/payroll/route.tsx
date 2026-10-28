import { assertCan } from "@/lib/permissions/can";
import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";
import { BasePageLoadingSkeleton } from "@/components/ui/base-page";
import { BackLink } from "@/components/ui/links";

export const Route = createFileRoute("/app/reports/payroll")({
	beforeLoad: ({ context }) => {
		assertCan(context.auth, "employees:payroll-information");
		assertCan(context.auth, "payroll-periods:view");
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
