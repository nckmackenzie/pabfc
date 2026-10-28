import {
	createFileRoute,
	Outlet,
	redirect,
	// useRouterState,
} from "@tanstack/react-router";
import { AppSidebar } from "@/components/ui/app-sidebar";
import { RouterBreadcrumb } from "@/components/ui/nav-breadcrumb";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Wip } from "@/components/ui/wip";
import { financialYearQueries } from "@/features/financial-years/services/queries";

export const Route = createFileRoute("/app")({
	beforeLoad: async ({ context, location }) => {
		// The root beforeLoad has just fetched authorization from the server.
		const { auth } = context;
		if (!auth || auth.user.role === "member") {
			throw redirect({ to: "/sign-in", search: { redirectTo: location.href } });
		}
		return { auth };
	},
	loader: ({ context }) => {
		void context.queryClient.prefetchQuery(financialYearQueries.current());
	},
	component: RouteComponent,
	notFoundComponent: () => <Wip />,
});

function RouteComponent() {
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
				<div className="flex flex-1 flex-col gap-4 bg-muted">
					<div className="max-w-7xl mx-auto w-full p-4 md:px-6 lg:px-8">
						<Outlet />
					</div>
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
