import { createFileRoute } from "@tanstack/react-router";
import { ProtectedPageWithWrapper } from "@/components/ui/protected-page-with-wrapper";
import { ComplimentaryRequestForm } from "@/features/receipts/components/complimentary-request-form";
import { memberQueries } from "@/features/members/services/queries";
import { planQueries } from "@/features/plans/services/queries";
import { requirePermission } from "@/lib/permissions/permissions";
import type { Route as RoutePath } from "@/types/index.types";

export const Route = createFileRoute("/app/receipts/complimentary/new")({
	beforeLoad: async () => {
		await requirePermission("receipts:complimentary-request");
	},
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "New Complimentary Membership / Prime Age Beauty & Fitness Club" }],
	}),
	staticData: { breadcrumb: "New Complimentary Request" },
	loader: async ({ context: { queryClient } }) => {
		const [members, plans] = await Promise.all([
			queryClient.ensureQueryData(memberQueries.activeMembers()),
			queryClient.ensureQueryData(planQueries.list()),
		]);
		return {
			members,
			// Only active, single-member plans are eligible for complimentary
			// membership — filtered here (not just validated server-side) so the
			// dropdown never offers an ineligible plan in the first place.
			plans: plans.filter((plan) => plan.active && plan.memberCount === 1),
		};
	},
});

function RouteComponent() {
	return (
		<ProtectedPageWithWrapper
			hasBackLink
			// Cast: `/app/receipts/complimentary` is the list route Task 11 adds
			// (src/routes/app/receipts/complimentary/index.tsx); it doesn't exist
			// in routeTree.gen.ts yet since Task 10 runs before Task 11. Same
			// precedent as app-sidebar.tsx's `as Route` cast.
			backPath={"/app/receipts/complimentary" as RoutePath}
			buttonText="Complimentary Requests"
			permissions={["receipts:complimentary-request"]}
			size="sm"
		>
			<ComplimentaryRequestForm />
		</ProtectedPageWithWrapper>
	);
}
