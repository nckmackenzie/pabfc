import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
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
		<div className="w-full lg:w-1/2 flex items-center justify-center bg-secondary p-6 lg:p-12">
			<Card className="w-full max-w-md shadow">
				<CardHeader>
					<CardTitle className="text-2xl font-bold">Sign In</CardTitle>
					<CardDescription>Sign in to your account.</CardDescription>
				</CardHeader>
				<CardContent>
					<LoginForm redirectTo={safeRedirectTo} />
				</CardContent>
			</Card>
		</div>
	);
}
