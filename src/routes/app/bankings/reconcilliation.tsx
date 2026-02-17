import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/app/bankings/reconcilliation")({
	component: RouteComponent,
	staticData: {
		breadcrumb: "Bank Reconcilliation",
	},
});

function RouteComponent() {
	return <div>Bank Reconcilliation</div>;
}
