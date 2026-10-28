import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";

export const Route = createFileRoute("/member/dashboard")({
	component: RouteComponent,
});

function RouteComponent() {
	const navigate = useNavigate();
	const router = useRouter();
	const queryClient = useQueryClient();
	const handleLogout = async () => {
		await authClient.signOut({
			fetchOptions: {
				onSuccess: async () => {
					queryClient.removeQueries({ queryKey: ["auth"] });
					await router.invalidate();
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
