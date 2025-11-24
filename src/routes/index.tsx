import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
	beforeLoad: ({ context }) => {
		if (!context.userSession) {
			redirect({ to: "/sign-in", throw: true });
		} else {
			if (context.userSession.user.userType === "member") {
				redirect({ to: "/member/dashboard", throw: true });
			}
			redirect({ to: "/app/dashboard", throw: true });
		}
	},
});
