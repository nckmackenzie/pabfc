import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AlertErrorComponent } from "@/components/ui/error-component";

export const Route = createFileRoute("/app/wht-corrections")({
	component: RouteComponent,
	errorComponent: ({ error }) => (
		<AlertErrorComponent message={error.message} />
	),
	staticData: {
		breadcrumb: "WHT Corrections",
	},
});

function RouteComponent() {
	return <Outlet />;
}
