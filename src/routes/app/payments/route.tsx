import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AlertErrorComponent } from "@/components/ui/error-component";

export const Route = createFileRoute("/app/payments")({
	component: RouteComponent,
	errorComponent: ({ error }) => (
		<AlertErrorComponent message={error instanceof Error ? error.message : String(error)} />
	),
	staticData: {
		breadcrumb: "Payments",
	},
});

function RouteComponent() {
	return <Outlet />;
}
