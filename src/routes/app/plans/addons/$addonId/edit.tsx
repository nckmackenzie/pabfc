import { useQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { FormLoader } from "@/components/ui/loaders";
import { ProtectedPageWithWrapper } from "@/components/ui/protected-page-with-wrapper";
import { AddonForm } from "@/features/addons/components/addon-form";
import { addonQueries } from "@/features/addons/services/queries";
import { requirePermission } from "@/lib/permissions/permissions";
import { toTitleCase } from "@/lib/utils";

export const Route = createFileRoute("/app/plans/addons/$addonId/edit")({
	beforeLoad: async () => {
		await requirePermission("plans:update");
	},
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "Edit Addon / Prime Age Beauty & Fitness Center" }],
	}),
	loader: async ({ params, context: { queryClient } }) => {
		const addon = await queryClient.ensureQueryData(
			addonQueries.detail(params.addonId),
		);
		if (!addon) {
			throw notFound();
		}
		return addon;
	},
	pendingComponent: FormLoader,
	staticData: {
		breadcrumb: (match) => `Edit ${toTitleCase(match.loaderData.name)}`,
	},
});

function RouteComponent() {
	const addon = Route.useLoaderData();
	const { addonId } = Route.useParams();
	const { data: freshAddon } = useQuery(addonQueries.detail(addonId));
	const currentAddon = freshAddon || addon;
	return (
		<ProtectedPageWithWrapper
			buttonText="Addons List"
			permissions={["plans:update"]}
			hasBackLink
			backPath="/app/plans/addons"
		>
			<AddonForm
				hasInvoiceLines={currentAddon.hasInvoiceLines}
				addon={{
					id: currentAddon.id,
					name: currentAddon.name,
					description: currentAddon.description ?? "",
					amount: Number(currentAddon.amount),
					perMember: currentAddon.perMember,
					active: currentAddon.active,
					revenueAccountId: currentAddon.revenueAccountId?.toString() ?? "",
				}}
			/>
		</ProtectedPageWithWrapper>
	);
}
