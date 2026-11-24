import { useQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { FormLoader } from "@/components/ui/loaders";
import { ProtectedPageWithWrapper } from "@/components/ui/protected-page-with-wrapper";
import { EnquiryForm } from "@/features/enquiries/components/enquiry-form";
import { enquiryQueries } from "@/features/enquiries/services/queries";
import { assertCan } from "@/lib/permissions/can";
import { toTitleCase } from "@/lib/utils";

export const Route = createFileRoute("/app/enquiries/$enquiryId/edit")({
	beforeLoad: ({ context }) => {
		assertCan(context.auth, "enquiries:update");
	},
	head: () => ({
		meta: [{ title: "Edit Enquiry / Prime Age Beauty & Fitness Center" }],
	}),
	component: RouteComponent,
	pendingComponent: () => <FormLoader />,
	loader: async ({ context: { queryClient }, params: { enquiryId } }) => {
		const [enquiry] = await Promise.all([
			queryClient.ensureQueryData(enquiryQueries.detail(enquiryId)),
			queryClient.ensureQueryData(enquiryQueries.planOptions()),
			queryClient.ensureQueryData(enquiryQueries.assignableEmployees()),
		]);
		if (!enquiry) {
			throw notFound();
		}
		return enquiry;
	},
	staticData: {
		breadcrumb: (match) => `Edit ${toTitleCase(match.loaderData.firstName)}'s enquiry`,
	},
});

function RouteComponent() {
	const loaderEnquiry = Route.useLoaderData();
	const { data: queryEnquiry } = useQuery(enquiryQueries.detail(Route.useParams().enquiryId));
	const enquiry = queryEnquiry ?? loaderEnquiry;

	return (
		<ProtectedPageWithWrapper
			permissions={["enquiries:update"]}
			hasBackLink
			backPath="/app/enquiries"
			buttonText="Enquiries List"
		>
			<EnquiryForm enquiry={enquiry} />
		</ProtectedPageWithWrapper>
	);
}
