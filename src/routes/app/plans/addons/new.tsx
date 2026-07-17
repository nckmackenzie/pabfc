import { createFileRoute } from "@tanstack/react-router";
import { FormLoader } from "@/components/ui/loaders";
import { ProtectedPageWithWrapper } from "@/components/ui/protected-page-with-wrapper";
import { AddonForm } from "@/features/addons/components/addon-form";
import { requirePermission } from "@/lib/permissions/permissions";

export const Route = createFileRoute("/app/plans/addons/new")({
	beforeLoad: async () => {
		await requirePermission("plans:create");
	},
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "New Addon / Prime Age Beauty & Fitness Center" }],
	}),
	pendingComponent: FormLoader,
	staticData: {
		breadcrumb: "New Addon",
	},
});

function RouteComponent() {
	return (
		<ProtectedPageWithWrapper
			buttonText="Addons List"
			permissions={["plans:create"]}
			hasBackLink
			backPath="/app/plans/addons"
		>
			<AddonForm />
		</ProtectedPageWithWrapper>
	);
}
