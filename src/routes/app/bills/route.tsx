import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AlertErrorComponent } from "@/components/ui/error-component";

export const Route = createFileRoute("/app/bills")({
	errorComponent: ({ error }) => (
		<AlertErrorComponent message={error.message} title="Error" />
	),
	component: RouteComponent,
	staticData: {
		breadcrumb: "Bills",
	},
});

function RouteComponent() {
	return <Outlet />;
}
