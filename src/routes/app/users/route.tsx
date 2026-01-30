import { createFileRoute, redirect } from "@tanstack/react-router";
import { AlertErrorComponent } from "@/components/ui/error-component";

export const Route = createFileRoute("/app/users")({
	staticData: {
		breadcrumb: "Users List",
	},
	beforeLoad: ({ context }) => {
		if (context.userSession?.user.role !== "admin") {
			throw redirect({ to: "/app/unauthorized" });
		}
	},
	errorComponent: ({ error }) => (
		<AlertErrorComponent message={error.message} />
	),
});
