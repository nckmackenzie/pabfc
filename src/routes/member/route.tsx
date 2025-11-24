import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/member")({
	component: RouteComponent,
});

function RouteComponent() {
	return <Outlet />;
}
