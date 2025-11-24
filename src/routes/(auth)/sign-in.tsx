import { createFileRoute } from "@tanstack/react-router";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/(auth)/sign-in")({
	head: () => ({
		meta: [{ title: "Sign In / Prime Age Beauty & Fitness Center" }],
	}),
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<div className="w-full lg:w-1/2 flex items-center justify-center bg-secondary p-6 lg:p-12">
			<Card className="w-full max-w-md shadow">
				<CardHeader>
					<CardTitle className="text-2xl font-bold">Sign In</CardTitle>
					<CardDescription>Sign in to your account.</CardDescription>
				</CardHeader>
				<CardContent></CardContent>
			</Card>
		</div>
	);
}
