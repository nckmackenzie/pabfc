import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/(auth)")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<div className="flex min-h-screen bg-accent items-center justify-center px-4 md:px-0">
			<div className="max-w-md w-full rounded-md bg-background border p-6 flex flex-col gap-y-6">
				<img
					src="/prime_age_horizontal_logo.png"
					alt="Prime Age Beauty and fitness center"
					className="h-12 w-auto mx-auto md:h-16"
				/>
				<Separator className="bg-muted" />
				<Outlet />
			</div>
		</div>
	);
}
