import { assertCan } from "@/lib/permissions/can";
import { BackLink } from "@/components/ui/links";
import { LeaveRequestForm } from "@/features/leaves/components/leave-request-form";
import { leaveQueries } from "@/features/leaves/services/queries";
import { seo } from "@/lib/helpers";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/app/leaves/new")({
	component: () => {
		return (
			<div className="space-y-6">
				<BackLink href="/app/leaves">Back to Leave Management</BackLink>
				<LeaveRequestForm />
			</div>
		);
	},
	beforeLoad: ({ context }) => {
		assertCan(context.auth, "leaves:create");
	},
	loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(leaveQueries.employees()),
	staticData: {
		breadcrumb: "Submit Leave Request",
	},
	head: () => ({ meta: seo({ title: "Submit Leave Request" }) }),
});
