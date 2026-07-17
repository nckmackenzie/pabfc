import { createFileRoute, notFound } from "@tanstack/react-router";
import { ProtectedPageWithWrapper } from "@/components/ui/protected-page-with-wrapper";
import {
	AddonReceiptDetails,
	AddonReceiptDetailsSkeleton,
} from "@/features/addons/components/addon-receipt-details";
import { addonQueries } from "@/features/addons/services/queries";
import { requirePermission } from "@/lib/permissions/permissions";

export const Route = createFileRoute(
	"/app/receipts/addons/$addonInvoiceId/details",
)({
	beforeLoad: async () => {
		await requirePermission("receipts:view");
	},
	head: () => ({
		meta: [
			{ title: "Addon Receipt Details / Prime Age Beauty & Fitness Club" },
		],
	}),
	component: RouteComponent,
	pendingComponent: AddonReceiptDetailsSkeleton,
	loader: async ({ context: { queryClient }, params: { addonInvoiceId } }) => {
		const invoice = await queryClient.ensureQueryData(
			addonQueries.invoice(addonInvoiceId),
		);
		if (!invoice) {
			throw notFound();
		}
		return invoice;
	},
	staticData: {
		breadcrumb: "Addon Receipt Details",
	},
});

function RouteComponent() {
	return (
		<ProtectedPageWithWrapper
			hasBackLink
			backPath="/app/receipts"
			buttonText="Receipts List"
			permissions={["receipts:view"]}
		>
			<AddonReceiptDetails />
		</ProtectedPageWithWrapper>
	);
}
