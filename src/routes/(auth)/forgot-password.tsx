import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(auth)/forgot-password")({
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "Forgot Password / Prime Age Beauty & Fitness Centre" }],
	}),
});

function RouteComponent() {
	return <div>Hello "/(auth)/forgot-password"!</div>;
}
