import { createFileRoute } from "@tanstack/react-router";
import { FormLoader } from "@/components/ui/loaders";
import { ProtectedPageWithWrapper } from "@/components/ui/protected-page-with-wrapper";
import { memberQueries } from "@/features/members/services/queries";
import { GuestPassForm } from "@/features/receipts/components/guest-pass-form";
import { guestPassQueries } from "@/features/receipts/services/guest-pass.queries";
import { requirePermission } from "@/lib/permissions/permissions";

export const Route = createFileRoute("/app/receipts/guest-pass/new")({
	beforeLoad: async () => {
		await requirePermission("receipts:guest-pass");
	},
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "Issue Guest Pass / Prime Age Beauty & Fitness Club" }],
	}),
	pendingComponent: FormLoader,
	loader: async ({ context: { queryClient } }) => {
		await Promise.all([
			queryClient.ensureQueryData(guestPassQueries.availablePlans()),
			queryClient.ensureQueryData(memberQueries.activeMembers()),
		]);
	},
	staticData: {
		breadcrumb: "Issue Guest Pass",
	},
});

function RouteComponent() {
	return (
		<ProtectedPageWithWrapper
			hasBackLink
			backPath="/app/receipts"
			buttonText="Receipts List"
			permissions={["receipts:guest-pass"]}
		>
			<GuestPassForm />
		</ProtectedPageWithWrapper>
	);
}
