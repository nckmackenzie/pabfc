import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AlertErrorComponent } from "@/components/ui/error-component";

export const Route = createFileRoute("/app/suppliers")({
	component: RouteComponent,
	errorComponent: ({ error }) => (
		<AlertErrorComponent message={error.message} />
	),
	staticData: {
		breadcrumb: "Suppliers",
	},
});

function RouteComponent() {
	return <Outlet />;
}
