import { createFileRoute } from "@tanstack/react-router";
import { Wip } from "@/components/ui/wip";

export const Route = createFileRoute("/app/users/roles/")({
	component: RouteComponent,
});

function RouteComponent() {
	return <Wip />;
}
