import { createFileRoute } from "@tanstack/react-router";
import {
	BasePageComponent,
	BasePageLoadingSkeleton,
} from "@/components/ui/base-page";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { ButtonLink } from "@/components/ui/links";
import { AddonsTable } from "@/features/addons/components/addons-table";
import { addonQueries } from "@/features/addons/services/queries";
import { requirePermission } from "@/lib/permissions/permissions";

export const Route = createFileRoute("/app/plans/addons/")({
	beforeLoad: async () => {
		await requirePermission("plans:view");
	},
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "Addons / Prime Age Beauty & Fitness Center" }],
	}),
	loader: async ({ context: { queryClient } }) => {
		await queryClient.ensureQueryData(addonQueries.list());
	},
	pendingComponent: () => (
		<BasePageLoadingSkeleton
			pageTitle="Addons"
			pageDescription="Create and manage optional extras billed to members"
		/>
	),
	staticData: {
		breadcrumb: "Addons",
	},
});

function RouteComponent() {
	return (
		<BasePageComponent
			pageTitle="Addons"
			pageDescription="Create and manage optional extras billed to members"
			buttonText="Create new Addon"
			hasNewButtonLink={true}
			newButtonLinkPath="/app/plans/addons/new"
			createPermissions={["plans:create"]}
			extraActionButtons={
				<ButtonLink
					variant="outline"
					path="/app/plans"
					icon={<ArrowLeftIcon />}
				>
					Back to Plans
				</ButtonLink>
			}
		>
			<AddonsTable />
		</BasePageComponent>
	);
}
