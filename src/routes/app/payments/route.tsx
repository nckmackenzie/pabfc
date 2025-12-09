import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/app/payments")({
	component: RouteComponent,
});

function RouteComponent() {
	return <Outlet />;
}
