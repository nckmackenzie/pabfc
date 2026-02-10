import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/lib/permissions/permissions";

export const Route = createFileRoute("/app/bills/new")({
	beforeLoad: async () => {
		await requirePermission("bills:create");
	},
	head: () => ({
		meta: [{ title: "New Bill / Prime Age Beauty & Fitness Centre" }],
	}),
	component: RouteComponent,
	staticData: {
		breadcrumb: "New Bill",
	},
});

function RouteComponent() {
	return <div>Hello "/app/bills/new"!</div>;
}
