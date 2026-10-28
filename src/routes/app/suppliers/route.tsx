import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AlertErrorComponent } from "@/components/ui/error-component";

export const Route = createFileRoute("/app/suppliers")({
	component: RouteComponent,
	errorComponent: ({ error }) => (
		<AlertErrorComponent message={error instanceof Error ? error.message : String(error)} />
	),
	staticData: {
		breadcrumb: "Suppliers",
	},
});

function RouteComponent() {
	return <Outlet />;
}
