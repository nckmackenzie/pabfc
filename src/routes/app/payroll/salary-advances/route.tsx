import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AlertErrorComponent } from "@/components/ui/error-component";

export const Route = createFileRoute("/app/payroll/salary-advances")({
	component: Outlet,
	staticData: {
		breadcrumb: "Salary Advances",
	},
	errorComponent: ({ error }) => {
		let errorMessage;
		if (error.message.includes("Failed query")) {
			errorMessage = "Failed to load required data. Please try again later.";
		} else {
			errorMessage = "An unexpected error occurred. Please try again.";
		}
		return <AlertErrorComponent message={errorMessage} title="Error" />;
	},
});
