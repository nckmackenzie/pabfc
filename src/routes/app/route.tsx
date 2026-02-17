import {
	createFileRoute,
	Outlet,
	redirect,
	useRouterState,
} from "@tanstack/react-router";
import { AppSidebar } from "@/components/ui/app-sidebar";
import { RouterBreadcrumb } from "@/components/ui/nav-breadcrumb";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Wip } from "@/components/ui/wip";

function Spinner({ show, wait }: { show?: boolean; wait?: `delay-${number}` }) {
	return (
		<div
			className={`inline-block animate-spin px-3 transition ${
				(show ?? true)
					? `opacity-1 duration-500 ${wait ?? "delay-300"}`
					: "duration-500 opacity-0 delay-0"
			}`}
		>
			⍥
		</div>
	);
}

export const Route = createFileRoute("/app")({
	beforeLoad: async ({ context, location }) => {
		if (!context.userSession || context.userSession.user.role === "member") {
			throw redirect({ to: "/sign-in", search: { redirectTo: location.href } });
		}
	},
	component: RouteComponent,
	notFoundComponent: () => <Wip />,
});

function RouteComponent() {
	const isLoading = useRouterState({ select: (s) => s.status === "pending" });
	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset>
				<header className="pr-4 flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
					<div className="flex items-center gap-2 px-4">
						<SidebarTrigger className="-ml-1" />
						<RouterBreadcrumb />
					</div>
					<div className="ml-auto">
						<UserAvatar />
					</div>
				</header>
				<div className="flex flex-1 flex-col gap-4 bg-secondary ">
					<div className="max-w-7xl mx-auto w-full p-4">
						{isLoading ? <Spinner show={isLoading} /> : <Outlet />}
					</div>
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
