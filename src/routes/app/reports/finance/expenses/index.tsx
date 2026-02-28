import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/app/reports/finance/expenses/")({
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "Finance Reports / Prime Age Beauty & Fitness Center" }],
	}),
	staticData: {
		breadcrumb: "Expenses reports",
	},
});

function RouteComponent() {
	return <div>Hello "/app/reports/finance/expenses/"!</div>;
}
