import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppSidebar } from "@/components/ui/app-sidebar";

import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";
import { UserAvatar } from "@/components/ui/user-avatar";

export const Route = createFileRoute("/app")({
	beforeLoad: async ({ context, location }) => {
		if (!context.userSession || context.userSession.user.role === "member") {
			throw redirect({ to: "/sign-in", search: { redirectTo: location.href } });
		}
	},
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset>
				<header className="pr-4 flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
					<div className="flex items-center gap-2 px-4">
						<SidebarTrigger className="-ml-1" />
					</div>
					<div className="ml-auto">
						<UserAvatar />
					</div>
				</header>
				<div className="flex flex-1 flex-col gap-4 bg-secondary ">
					<div className="max-w-7xl mx-auto w-full p-4">
						<Outlet />
					</div>
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
