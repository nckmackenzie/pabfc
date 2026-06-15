import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AlertErrorComponent } from "@/components/ui/error-component";

export const Route = createFileRoute("/app/payroll")({
	component: Outlet,
	staticData: {
		breadcrumb: "Payroll",
	},
	errorComponent: ({ error }) => (
		<AlertErrorComponent message={error.message} title="Error" />
	),
});
