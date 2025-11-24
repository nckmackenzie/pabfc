import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";

export const Route = createFileRoute("/app/dashboard")({
	head: () => ({
		meta: [{ title: "Dashboard / Prime Age Beauty & Fitness Center" }],
	}),
	component: RouteComponent,
});

function RouteComponent() {
	const router = useRouter();
	async function handleLogout() {
		// setOpenMobile(!openMobile)
		await authClient.signOut();
		router.navigate({ to: "/sign-in" });
		router.invalidate();
		// await queryClient.invalidateQueries()
	}
	return (
		<div>
			<Button onClick={handleLogout}>signout</Button>
		</div>
	);
}
