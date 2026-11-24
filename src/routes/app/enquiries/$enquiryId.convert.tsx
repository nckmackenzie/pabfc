import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, notFound, redirect, useNavigate } from "@tanstack/react-router";
import { CustomAlert } from "@/components/ui/custom-alert";
import { FormLoader } from "@/components/ui/loaders";
import { ProtectedPageWithWrapper } from "@/components/ui/protected-page-with-wrapper";
import { isOpenStatus } from "@/features/enquiries/lib/enquiry-status";
import { convertEnquiryFn } from "@/features/enquiries/services/enquiries.conversion.api";
import { enquiryQueries } from "@/features/enquiries/services/queries";
import { MemberForm } from "@/features/members/components/member-form";
import { assertCan } from "@/lib/permissions/can";
import { toTitleCase } from "@/lib/utils";

export const Route = createFileRoute("/app/enquiries/$enquiryId/convert")({
	beforeLoad: ({ context }) => {
		assertCan(context.auth, "enquiries:convert");
		assertCan(context.auth, "members:create");
	},
	head: () => ({
		meta: [{ title: "Convert Enquiry / Prime Age Beauty & Fitness Center" }],
	}),
	component: RouteComponent,
	pendingComponent: () => <FormLoader />,
	loader: async ({ context: { queryClient }, params: { enquiryId } }) => {
		const enquiry = await queryClient.ensureQueryData(enquiryQueries.detail(enquiryId));
		if (!enquiry) {
			throw notFound();
		}
		// Only open enquiries can be converted; send anything else back to its page.
		if (!isOpenStatus(enquiry.status)) {
			throw redirect({ to: "/app/enquiries/$enquiryId", params: { enquiryId } });
		}
		return enquiry;
	},
	staticData: {
		breadcrumb: (match) => `Convert ${toTitleCase(match.loaderData.firstName)}`,
	},
});

function RouteComponent() {
	const enquiry = Route.useLoaderData();
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	// The server rechecks this; showing it up front saves a failed submit.
	const { data: duplicates } = useQuery(enquiryQueries.duplicates(enquiry.phone, enquiry.id));
	const existingMember = duplicates?.member;

	return (
		<ProtectedPageWithWrapper
			permissions={["enquiries:convert"]}
			hasBackLink
			backPath="/app/enquiries"
			buttonText="Enquiries List"
		>
			{existingMember && (
				<CustomAlert
					variant="warning"
					title="This number already belongs to a member"
					description={
						<span>
							{existingMember.name} (member no. {existingMember.memberNo}) uses {enquiry.phone}.{" "}
							<Link
								to="/app/enquiries/$enquiryId"
								params={{ enquiryId: enquiry.id }}
								className="font-medium underline"
							>
								Go back to the enquiry
							</Link>{" "}
							to link it to them instead.
						</span>
					}
				/>
			)}
			<MemberForm
				title="Convert to Member"
				description="Review the details from the enquiry and complete the registration."
				initialValues={{
					firstName: enquiry.firstName,
					lastName: enquiry.lastName ?? "",
					contact: enquiry.phone,
					email: enquiry.email,
					notes: enquiry.notes,
				}}
				submitOverride={{
					entityName: "Member",
					submitLabel: "Convert and record payment",
					lockContact: true,
					upsertFn: (member) => convertEnquiryFn({ data: { enquiryId: enquiry.id, member } }),
					onSuccess: ({ memberId }) => {
						queryClient.invalidateQueries({ queryKey: enquiryQueries.all });
						navigate({ to: "/app/receipts/new", search: { memberId } });
					},
				}}
			/>
		</ProtectedPageWithWrapper>
	);
}
