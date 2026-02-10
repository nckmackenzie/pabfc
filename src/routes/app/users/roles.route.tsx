import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/app/users/roles")({
	component: RouteComponent,
	staticData: {
		breadcrumb: "Roles",
	},
});

function RouteComponent() {
	return <Outlet />;
}
