import { createFileRoute, redirect } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui/page-header";
import { Wrapper } from "@/components/ui/wrapper";
import { SettingsForm } from "@/features/settings/components/settings-form";

export const Route = createFileRoute("/app/settings")({
	head: () => ({
		meta: [{ title: "Settings / Prime Age Beauty & Fitness Center" }],
	}),
	beforeLoad: async ({ context: { userSession } }) => {
		if (userSession?.user.role !== "admin") {
			throw redirect({ to: "/app/unauthorized" });
		}
	},
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<Wrapper size="full">
			<PageHeader
				title="Settings"
				description="Define application settings and preferences"
			/>
			<SettingsForm />
		</Wrapper>
	);
}
