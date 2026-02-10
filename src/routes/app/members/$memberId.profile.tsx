import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { z } from "zod";
import { PageHeader } from "@/components/ui/page-header";
import { ProtectedPageWithWrapper } from "@/components/ui/protected-page-with-wrapper";
import { MemberProfile } from "@/features/members/components/member-profile";
import { MemberProfileSkeleton } from "@/features/members/components/member-profile-skeleton";
import { memberQueries } from "@/features/members/services/queries";
import { requirePermission } from "@/lib/permissions/permissions";
import { toTitleCase } from "@/lib/utils";
import { logActivity } from "@/services/activity-logger";

export const Route = createFileRoute("/app/members/$memberId/profile")({
	beforeLoad: async () => {
		await requirePermission("members:view-profile");
	},
	validateSearch: z.object({
		vid: z.string().min(1, { error: "Visit id is required" }),
	}),
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "Member Profile / Prime Age Beauty & Fitness Center" }],
	}),
	loader: async ({ context: { queryClient }, params: { memberId } }) => {
		const member = await queryClient.ensureQueryData(
			memberQueries.overview(memberId),
		);
		if (!member) {
			throw notFound();
		}

		return member;
	},
	pendingComponent: MemberProfileSkeleton,
	staticData: {
		breadcrumb: (match) =>
			`Profile for ${toTitleCase(match.loaderData.member.fullName)}`,
	},
});

function RouteComponent() {
	const member = Route.useLoaderData();
	const { userSession } = Route.useRouteContext();
	const { vid } = Route.useSearch();
	const memberName = useMemo(
		() => `${member.firstName} ${member.lastName}`,
		[member],
	);

	useEffect(() => {
		async function logVisit() {
			logActivity({
				data: {
					userId: userSession?.user.id as string,
					action: "view member profile",
					description: `viewed member profile for member ${memberName}`,
					id: vid,
				},
			});
		}

		logVisit();
	}, [memberName, userSession?.user.id, vid]);

	return (
		<ProtectedPageWithWrapper
			hasBackLink
			backPath="/app/members"
			buttonText="Members List"
			permissions={["members:view-profile"]}
		>
			<PageHeader
				title="Member Profile"
				description="View member profile, membership history, attendance, payment history, and more"
			/>
			<MemberProfile />
		</ProtectedPageWithWrapper>
	);
}
