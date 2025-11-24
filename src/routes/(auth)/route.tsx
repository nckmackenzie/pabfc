import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/(auth)")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<div className="flex h-screen items-center justify-center">
			<div className="flex flex-col space-y-4 border p-4 max-w-md w-full rounded-md">
				<img
					alt="Logo for dummy sacco"
					src="/logo_512.png"
					className="size-50 self-center"
				/>
				<Outlet />
			</div>
		</div>
	);
}
