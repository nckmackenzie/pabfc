import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AlertErrorComponent } from "@/components/ui/error-component";

export const Route = createFileRoute("/app/wht-remittances")({
	component: RouteComponent,
	errorComponent: ({ error }) => (
		<AlertErrorComponent message={error instanceof Error ? error.message : String(error)} />
	),
	staticData: {
		breadcrumb: "WHT Remittances",
	},
});

function RouteComponent() {
	return <Outlet />;
}
