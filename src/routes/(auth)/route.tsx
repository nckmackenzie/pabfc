import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/(auth)")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<div className="flex min-h-screen bg-background">
			<div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-black p-12 text-white relative overflow-hidden">
				<div className="absolute inset-0 opacity-20">
					<div className="absolute inset-0 bg-linear-to-b from-orange-900/20 via-transparent to-transparent" />
				</div>

				<div className="relative z-10">
					{/* Logo */}
					<div className="flex items-center gap-3 mb-12">
						<img
							src="/logo_48_dark1.png"
							alt="Prime Age Beauty & Fitness Center"
							className="w-12 h-12"
						/>
						<div>
							<h1 className="font-bold text-lg">
								Prime Age Beauty &amp; Fitness Center
							</h1>
							<p className="text-sm text-gray-400">Train. Recover. Repeat.</p>
						</div>
					</div>
					<div className="mt-20">
						<h2 className="text-5xl font-bold leading-tight mb-6">
							Stronger <span className="text-primary">Every Day</span>
						</h2>
						<p className="text-gray-300 text-lg leading-relaxed max-w-sm">
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
			<Outlet />
		</div>
	);
}
