import { BackLink } from "@/components/ui/links";
import { PageHeader } from "@/components/ui/page-header";
import { LeaveBalancesPanel } from "@/features/leaves/components/leave-balances-panel";
import { leaveQueries } from "@/features/leaves/services/queries";
import { leaveBalanceViewSchema } from "@/features/leaves/utils/schemas";
import { seo } from "@/lib/helpers";
import { requirePermission } from "@/lib/permissions/permissions";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/app/leaves/balances")({
  validateSearch: leaveBalanceViewSchema,
  component: () => {
    return (
      <div className="space-y-6">
        <BackLink href="/app/leaves">Back to Leave Management</BackLink>
        <PageHeader
          title="Leave Balances"
          description="Inspect yearly balances, pending usage, carry-forward expiry, and manual adjustments."
        />
        <LeaveBalancesPanel />
      </div>
    );
  },
  head: () => ({ meta: seo({ title: "Leave Balances" }) }),
  beforeLoad: async () => {
    await requirePermission("leaves:view");
  },
  loader: async ({ context: { queryClient } }) => {
    return await queryClient.ensureQueryData(leaveQueries.employees());
  },
});
