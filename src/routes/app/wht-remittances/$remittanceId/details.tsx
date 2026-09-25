import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ProtectedPageWithWrapper } from "@/components/ui/protected-page-with-wrapper";
import {
	RemittanceDetails,
	RemittanceDetailsSkeleton,
} from "@/features/wht-remittances/components/remittance-details";
import { remittanceQueries } from "@/features/wht-remittances/services/queries";
import { requirePermission } from "@/lib/permissions/permissions";

export const Route = createFileRoute(
	"/app/wht-remittances/$remittanceId/details",
)({
	beforeLoad: async () => {
		await requirePermission("wht-remittances:view");
	},
	head: () => ({
		meta: [
			{ title: "WHT Remittance Details / Prime Age Beauty & Fitness Club" },
		],
	}),
	component: RouteComponent,
	loader: async ({ context: { queryClient }, params: { remittanceId } }) =>
		queryClient.ensureQueryData(remittanceQueries.detail(remittanceId)),
	staticData: {
		breadcrumb: (match) =>
			`Remittance #${match.loaderData.remittanceNo} Details`,
	},
	pendingComponent: RemittanceDetailsSkeleton,
});

function RouteComponent() {
	const { remittanceId } = Route.useParams();
	const loaderRemittance = Route.useLoaderData();
	const { data: remittance } = useQuery(
		remittanceQueries.detail(remittanceId),
	);
	return (
		<ProtectedPageWithWrapper
			hasBackLink
			backPath="/app/wht-remittances"
			buttonText="Remittances List"
			permissions={["wht-remittances:view"]}
		>
			<RemittanceDetails remittance={remittance ?? loaderRemittance} />
		</ProtectedPageWithWrapper>
	);
}
