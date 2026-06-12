import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AlertErrorComponent } from "@/components/ui/error-component";

export const Route = createFileRoute("/app/employees")({
	component: Outlet,
	staticData: {
		breadcrumb: "Employees",
	},
	errorComponent: ({ error }) => (
		<AlertErrorComponent message={error.message} title="Error" />
	),
});
