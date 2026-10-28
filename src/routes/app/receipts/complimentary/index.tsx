import { assertCanAny } from "@/lib/permissions/can";
import { createFileRoute } from "@tanstack/react-router";
import { BasePageComponent } from "@/components/ui/base-page";
import { ComplimentaryRequestsTable } from "@/features/receipts/components/complimentary-requests-table";

export const Route = createFileRoute("/app/receipts/complimentary/")({
	beforeLoad: ({ context }) => {
		assertCanAny(context.auth, [
			"receipts:complimentary-request",
			"receipts:complimentary-approve",
		]);
	},
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "Complimentary Memberships / Prime Age Beauty & Fitness Club" }],
	}),
	staticData: { breadcrumb: "Complimentary Memberships" },
});

function RouteComponent() {
	return (
		<BasePageComponent
			pageTitle="Complimentary Memberships"
			pageDescription="Review and action complimentary membership requests"
			hasNewButtonLink
			newButtonLinkPath="/app/receipts/complimentary/new"
			createPermissions={["receipts:complimentary-request"]}
			buttonText="Request Complimentary Membership"
		>
			<ComplimentaryRequestsTable />
		</BasePageComponent>
	);
}
