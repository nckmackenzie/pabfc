import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(auth)/sign-in")({
	head: () => ({
		meta: [{ title: "Sign In / Sacco Management" }],
	}),
	component: RouteComponent,
});

function RouteComponent() {
	return <div>
		<h1>Sign In</h1>
		<Input placeholder="Email" />
		
		<Button>Sign In</Button>
	</div>;
}
