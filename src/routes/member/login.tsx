import { createFileRoute, redirect } from "@tanstack/react-router";
import { Dumbbell } from "lucide-react";
import { z } from "zod";
import { MemberLoginForm } from "@/features/portal/auth/components/login-form";
import { sanitizeRedirect } from "@/hooks/use-previous-location";

export const Route = createFileRoute("/member/login")({
	beforeLoad: async ({ search, context }) => {
		const safe = sanitizeRedirect(search.redirectTo ?? "/member/dashboard");
		if (context.userSession) {
			throw redirect({ to: safe });
		}
		return { safeRedirectTo: safe };
	},
	head: () => ({
		meta: [
			{
				title: "Login / Members's Portal",
			},
		],
	}),
	component: RouteComponent,
	validateSearch: z.object({
		redirectTo: z.string().optional().catch("/member/dashboard"),
	}),
});

function RouteComponent() {
	const { safeRedirectTo } = Route.useRouteContext();
	return (
		<div className="bg-linear-to-r from-emerald-400 to-cyan-400 dark:bg-linear-to-r dark:from-emerald-900 dark:to-cyan-900 min-h-screen grid grid-cols-1 lg:grid-cols-2">
			<div className="hidden lg:block p-6">
				<div className="relative z-10">
					<div className="flex items-center gap-3 mb-12">
						<img
							src="/logo_48_dark.png"
							alt="Prime Age Beauty & Fitness Center"
							className="w-12 h-12"
						/>
						<div>
							<h1 className="font-bold text-lg">
								Prime Age Beauty &amp; Fitness Center
							</h1>
							<p className="text-sm text-accent-foreground">
								Train. Recover. Repeat.
							</p>
						</div>
					</div>
					<div className="mt-20">
						<h2 className="text-5xl font-bold leading-tight mb-6">
							Stronger <span className="text-primary">Every Day</span>
						</h2>
						<p className="text-gray-800 text-lg leading-relaxed max-w-sm">
							Log in to book classes, track your progress, and stay accountable
							to your fitness goals with our coaching team.
						</p>
					</div>
				</div>
				<div className="relative z-10">
					<p className="text-xs text-gray-500 mt-12">
						Members get access to 24/7 facilities, small group classes, and
						personalized training plans.
					</p>
				</div>
			</div>
			<div className="bg-background p-6 h-full  flex items-center justify-center ">
				<div className="max-w-md w-full flex flex-col gap-4 items-center justify-center ">
					<div className="size-12 rounded-full bg-primary flex items-center justify-center">
						<Dumbbell className="w-6 h-6 text-background" />
					</div>
					<div className="space-y-1">
						<h2 className="text-2xl font-bold text-center">Member Login</h2>
						<p className="text-sm text-muted-foreground text-center">
							Enter your credentials to access your account.
						</p>
					</div>
					<MemberLoginForm redirectTo={safeRedirectTo} />
				</div>
			</div>
		</div>
	);
}
