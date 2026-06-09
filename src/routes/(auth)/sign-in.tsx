import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { LoginForm } from "@/features/auth/login/components/login-form";
import { sanitizeRedirect } from "@/hooks/use-previous-location";

export const Route = createFileRoute("/(auth)/sign-in")({
	beforeLoad: async ({ search, context }) => {
		const safe = sanitizeRedirect(search.redirectTo);
		if (context.userSession) {
			throw redirect({ to: safe });
		}
		return { safeRedirectTo: safe };
	},
	head: () => ({
		meta: [{ title: "Sign In / Prime Age Beauty & Fitness Center" }],
	}),
	component: RouteComponent,
	validateSearch: z.object({
		redirectTo: z.string().optional().catch("/dashboard"),
	}),
});

function RouteComponent() {
	const { safeRedirectTo } = Route.useRouteContext();
	return (
		<div className="flex flex-col gap-y-6 w-full">
			<div className="flex flex-col text-center">
				<h1 className="text-2xl font-bold">Welcome Back</h1>
				<p className="text-muted-foreground text-sm">Sign in to your account</p>
			</div>
			<LoginForm redirectTo={safeRedirectTo} />
		</div>
	);
}
