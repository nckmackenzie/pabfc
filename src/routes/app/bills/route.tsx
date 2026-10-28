import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AlertErrorComponent } from "@/components/ui/error-component";

export const Route = createFileRoute("/app/bills")({
	errorComponent: ({ error }) => (
		<AlertErrorComponent
			message={error instanceof Error ? error.message : String(error)}
			title="Error"
		/>
	),
	component: RouteComponent,
	staticData: {
		breadcrumb: "Bills",
	},
});

function RouteComponent() {
	return <Outlet />;
}
