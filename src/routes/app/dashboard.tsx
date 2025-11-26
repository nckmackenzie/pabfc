import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui/page-header";
import { Wrapper } from "@/components/ui/wrapper";

export const Route = createFileRoute("/app/dashboard")({
	head: () => ({
		meta: [{ title: "Dashboard / Prime Age Beauty & Fitness Center" }],
	}),
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<Wrapper size="full">
			<PageHeader title="Dashboard" description="Welcome to your dashboard" />
		</Wrapper>
	);
}
