import { useQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { FormLoader } from "@/components/ui/loaders";
import { ProtectedPageWithWrapper } from "@/components/ui/protected-page-with-wrapper";
import { MemberForm } from "@/features/members/components/member-form";
import { memberQueries } from "@/features/members/services/queries";
import { requirePermission } from "@/lib/permissions/permissions";
import { toTitleCase } from "@/lib/utils";

export const Route = createFileRoute("/app/members/$memberId/edit")({
	beforeLoad: async () => {
		await requirePermission("members:update");
	},
	head: () => ({
		meta: [{ title: "Edit Member / Prime Age Beauty & Fitness Center" }],
	}),
	component: RouteComponent,
	pendingComponent: () => <FormLoader />,
	loader: async ({ context: { queryClient }, params: { memberId } }) => {
		const member = await queryClient.ensureQueryData(
			memberQueries.detail(memberId),
		);
		if (!member) {
			throw notFound();
		}
		return member;
	},
	staticData: {
		breadcrumb: (match) =>
			`Edit ${toTitleCase(match.loaderData.member.fullName)}`,
	},
});

function RouteComponent() {
	const loaderMember = Route.useLoaderData();
	const { data: queryMember } = useQuery(
		memberQueries.detail(Route.useParams().memberId),
	);
	const member = queryMember ?? loaderMember;
	return (
		<ProtectedPageWithWrapper
			permissions={["members:update"]}
			hasBackLink
			backPath="/app/members"
			buttonText="Members List"
		>
			<MemberForm
				member={{
					...member,
					dateOfBirth: member.dateOfBirth ?? null,
					contact: member.contact || "",
				}}
			/>
		</ProtectedPageWithWrapper>
	);
}
