import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AlertErrorComponent } from "@/components/ui/error-component";

export const Route = createFileRoute("/app/payroll/loans")({
	component: Outlet,
	staticData: {
		breadcrumb: "Employee Loans",
	},
	errorComponent: ({ error }) => (
		<AlertErrorComponent message={error.message} title="Error" />
	),
});
