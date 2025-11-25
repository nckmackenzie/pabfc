import { createFileRoute } from "@tanstack/react-router";
import { Unauthorized } from "@/components/ui/unauthorized";

export const Route = createFileRoute("/app/unauthorized")({
	component: RouteComponent,
});

function RouteComponent() {
	return <Unauthorized />;
}
