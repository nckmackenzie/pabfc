import { createFileRoute, useNavigate } from "@tanstack/react-router";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";

export const Route = createFileRoute("/member/dashboard")({
	component: RouteComponent,
});

function RouteComponent() {
	const navigate = useNavigate();
	const handleLogout = async () => {
		await authClient.signOut({
			fetchOptions: {
				onSuccess: () => {
					navigate({ to: "/member/login" });
				},
				onError: () => {
					toast.error("Failed to sign out");
				},
			},
		});
	};
	return (
		<div>
			<Button onClick={handleLogout}>Logout</Button>
		</div>
	);
}
