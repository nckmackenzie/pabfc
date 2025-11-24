import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/app/dashboard")({
	head: () => ({
		meta: [{ title: "Dashboard / Sacco Management" }],
	}),
	component: RouteComponent,
});

function RouteComponent() {
	return <div>Dashboard</div>;
}
