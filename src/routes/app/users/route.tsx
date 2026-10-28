import { createFileRoute, redirect } from "@tanstack/react-router";
import { AlertErrorComponent } from "@/components/ui/error-component";

export const Route = createFileRoute("/app/users")({
	staticData: {
		breadcrumb: "Users List",
	},
	beforeLoad: ({ context }) => {
		if (context.auth?.user.role !== "admin") {
			throw redirect({ to: "/app/unauthorized" });
		}
	},
	errorComponent: ({ error }) => (
		<AlertErrorComponent message={error instanceof Error ? error.message : String(error)} />
	),
});
