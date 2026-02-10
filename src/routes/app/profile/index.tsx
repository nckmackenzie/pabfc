import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui/page-header";
import { Wrapper } from "@/components/ui/wrapper";
import { ProfileForm } from "@/features/profile/components/profile-form";

export const Route = createFileRoute("/app/profile/")({
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "Profile / Prime Age Beauty & Fitness Center" }],
	}),
	staticData: {
		breadcrumb: "My Profile",
	},
});

function RouteComponent() {
	const { userSession } = Route.useRouteContext();

	return (
		<Wrapper size="full">
			<PageHeader
				title="Profile"
				description="Update your personal details and security settings"
			/>
			<ProfileForm user={userSession?.user} />
		</Wrapper>
	);
}
