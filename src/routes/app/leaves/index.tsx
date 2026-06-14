import { createFileRoute } from "@tanstack/react-router";
import { BasePageLoadingSkeleton } from "@/components/ui/base-page";
import { leaveRequestListFilterSchema } from "@/features/leaves/utils/schemas";
import { seo } from "@/lib/helpers";
import { requirePermission } from "@/lib/permissions/permissions";
import { LeaveRequestsPage } from "@/features/leaves/components/leave-requests-page";

export const Route = createFileRoute("/app/leaves/")({
  beforeLoad: async () => {
    await requirePermission("leaves:view");
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
