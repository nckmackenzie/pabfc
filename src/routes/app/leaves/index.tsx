import { assertCan } from "@/lib/permissions/can";
import { createFileRoute } from "@tanstack/react-router";
import { BasePageLoadingSkeleton } from "@/components/ui/base-page";
import { leaveRequestListFilterSchema } from "@/features/leaves/utils/schemas";
import { seo } from "@/lib/helpers";
import { LeaveRequestsPage } from "@/features/leaves/components/leave-requests-page";

export const Route = createFileRoute("/app/leaves/")({
	beforeLoad: ({ context }) => {
		assertCan(context.auth, "leaves:view");
	},
	component: LeaveRequestsPage,
	validateSearch: leaveRequestListFilterSchema,
	head: () => ({ meta: seo({ title: "Leave Management" }) }),
	pendingComponent: () => (
		<BasePageLoadingSkeleton
			pageTitle="Leave Management"
			pageDescription="Track leave requests and payroll impact"
		/>
	),
});
