import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/app/bankings/clear")({
	component: RouteComponent,
	staticData: {
		breadcrumb: "Clear bankings",
	},
});

function RouteComponent() {
	return <div>Bank Clearings</div>;
}
