import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AlertErrorComponent } from "@/components/ui/error-component";

export const Route = createFileRoute("/app/payroll/salary-structures")({
	component: Outlet,
	staticData: {
		breadcrumb: "Salary Structures",
	},
	errorComponent: ({ error }) => (
		<AlertErrorComponent message={error.message} title="Error" />
	),
});
