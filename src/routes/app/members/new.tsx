import { createFileRoute } from "@tanstack/react-router";
import { Wip } from "@/components/ui/wip";

export const Route = createFileRoute("/app/members/new")({
	component: RouteComponent,
});

function RouteComponent() {
	return <Wip />;
}
