import { createFileRoute } from "@tanstack/react-router";
import { PageWrapperWithBackLink } from "@/components/ui/edit-page-wrapper";
import { FormLoader } from "@/components/ui/loaders";
import { ProtectedPage } from "@/components/ui/protected-page";
import { EnquiryForm } from "@/features/enquiries/components/enquiry-form";
import { enquiryQueries } from "@/features/enquiries/services/queries";
import { assertCan } from "@/lib/permissions/can";

export const Route = createFileRoute("/app/enquiries/new")({
	beforeLoad: ({ context }) => {
		assertCan(context.auth, "enquiries:create");
	},
	head: () => ({
		meta: [{ title: "New Enquiry / Prime Age Beauty & Fitness Center" }],
	}),
	pendingComponent: () => <FormLoader />,
	loader: async ({ context: { queryClient } }) => {
		await Promise.all([
			queryClient.ensureQueryData(enquiryQueries.planOptions()),
			queryClient.ensureQueryData(enquiryQueries.assignableEmployees()),
		]);
	},
	component: RouteComponent,
	staticData: {
		breadcrumb: "New Enquiry",
	},
});

function RouteComponent() {
	return (
		<ProtectedPage permissions={["enquiries:create"]}>
			<PageWrapperWithBackLink backPath="/app/enquiries" buttonText="Enquiries List">
				<EnquiryForm />
			</PageWrapperWithBackLink>
		</ProtectedPage>
	);
}
