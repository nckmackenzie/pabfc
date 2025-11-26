import { createFileRoute } from "@tanstack/react-router";
import { Wip } from "@/components/ui/wip";

export const Route = createFileRoute("/(auth)/forgot-password")({
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "Forgot Password / Prime Age Beauty & Fitness Centre" }],
	}),
});

function RouteComponent() {
	return <Wip />;
}
