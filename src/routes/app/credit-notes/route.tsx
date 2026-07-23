import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AlertErrorComponent } from "@/components/ui/error-component";

export const Route = createFileRoute("/app/credit-notes")({
	component: RouteComponent,
	errorComponent: ({ error }) => <AlertErrorComponent message={error.message} />,
	staticData: {
		breadcrumb: "Credit Notes",
	},
});

function RouteComponent() {
	return <Outlet />;
}
