import { useQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { FormLoader } from "@/components/ui/loaders";
import { ProtectedPageWithWrapper } from "@/components/ui/protected-page-with-wrapper";
import { EnquiryDetail } from "@/features/enquiries/components/enquiry-detail";
import { enquiryQueries } from "@/features/enquiries/services/queries";
import { assertCan } from "@/lib/permissions/can";
import { toTitleCase } from "@/lib/utils";

export const Route = createFileRoute("/app/enquiries/$enquiryId/")({
	beforeLoad: ({ context }) => {
		assertCan(context.auth, "enquiries:view");
	},
	head: () => ({
		meta: [{ title: "Enquiry / Prime Age Beauty & Fitness Center" }],
	}),
	component: RouteComponent,
	pendingComponent: () => <FormLoader />,
	loader: async ({ context: { queryClient }, params: { enquiryId } }) => {
		const enquiry = await queryClient.ensureQueryData(enquiryQueries.detail(enquiryId));
		if (!enquiry) {
			throw notFound();
		}
		return enquiry;
	},
	staticData: {
		breadcrumb: (match) => toTitleCase(match.loaderData.firstName),
	},
});

function RouteComponent() {
	const loaderEnquiry = Route.useLoaderData();
	const { data: queryEnquiry } = useQuery(enquiryQueries.detail(Route.useParams().enquiryId));
	const enquiry = queryEnquiry ?? loaderEnquiry;

	return (
		<ProtectedPageWithWrapper
			permissions={["enquiries:view"]}
			hasBackLink
			backPath="/app/enquiries"
			buttonText="Enquiries List"
		>
			<EnquiryDetail enquiry={enquiry} />
		</ProtectedPageWithWrapper>
	);
}
