import { createFileRoute, redirect } from "@tanstack/react-router";
import { ForgotPasswordForm } from "@/features/auth/forgot-password/components/forgot-password-form";

export const Route = createFileRoute("/(auth)/forgot-password")({
	beforeLoad: async ({ context }) => {
		if (context.userSession) {
			throw redirect({ to: "/app/dashboard" });
		}
	},
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "Forgot Password / Prime Age Beauty & Fitness Centre" }],
	}),
});

function RouteComponent() {
	return <ForgotPasswordForm />;
}
