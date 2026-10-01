import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ProtectedPageWithWrapper } from "@/components/ui/protected-page-with-wrapper";
import {
	CorrectionDetails,
	CorrectionDetailsSkeleton,
} from "@/features/wht-corrections/components/correction-details";
import { correctionQueries } from "@/features/wht-corrections/services/queries";
import { requirePermission } from "@/lib/permissions/permissions";

export const Route = createFileRoute(
	"/app/wht-corrections/$correctionId/details",
)({
	beforeLoad: async () => {
		await requirePermission("wht-corrections:view");
	},
	head: () => ({
		meta: [
			{ title: "WHT Correction Details / Prime Age Beauty & Fitness Club" },
		],
	}),
	component: RouteComponent,
	loader: async ({ context: { queryClient }, params: { correctionId } }) =>
		queryClient.ensureQueryData(correctionQueries.detail(correctionId)),
	staticData: {
		breadcrumb: (match) =>
			`Correction #${match.loaderData.correctionNo} Details`,
	},
	pendingComponent: CorrectionDetailsSkeleton,
});

function RouteComponent() {
	const { correctionId } = Route.useParams();
	const loaderCorrection = Route.useLoaderData();
	const { data: correction } = useQuery(
		correctionQueries.detail(correctionId),
	);
	return (
		<ProtectedPageWithWrapper
			hasBackLink
			backPath="/app/wht-corrections"
			buttonText="Corrections List"
			permissions={["wht-corrections:view"]}
		>
			<CorrectionDetails correction={correction ?? loaderCorrection} />
		</ProtectedPageWithWrapper>
	);
}
