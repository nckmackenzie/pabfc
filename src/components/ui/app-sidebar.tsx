import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useRouter } from "@tanstack/react-router";
import {
	BarChartIcon,
	CalendarIcon,
	ChartPieIcon,
	ChatMessageIcon,
	PackageIcon,
	PaymentCardIcon,
	PercentBadgeIcon,
	PersonBadgeIcon,
	UsersIcon,
} from "@/components/ui/icons";

import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth/client";

const menuItems = [
	{
		title: "Dashboard",
		url: "/app/dashboard",
		icon: ChartPieIcon,
	},
	{
		title: "User Management",
		url: "/app/users",
		icon: UsersIcon,
	},
	{
		title: "Member Management",
		url: "/app/members",
		icon: PersonBadgeIcon,
	},
	{
		title: "Plans & Packages",
		url: "/app/plans",
		icon: PercentBadgeIcon,
	},
	{
		title: "Payments & Billing",
		url: "/app/payments",
		icon: PaymentCardIcon,
	},
	{
		title: "Attendance",
		url: "/app/attendance",
		icon: CalendarIcon,
	},
	{
		title: "Communication",
		url: "/app/communication",
		icon: ChatMessageIcon,
	},
	{
		title: "Reports",
		url: "/reports",
		icon: BarChartIcon,
	},
];

export function AppSidebar() {
	const { pathname } = useLocation();
	const queryClient = useQueryClient();
	const { setOpenMobile, openMobile } = useSidebar();
	const router = useRouter();

	async function handleLogout() {
		setOpenMobile(!openMobile);
		await authClient.signOut();
		router.navigate({ to: "/sign-in", replace: true });
		router.invalidate();
		await queryClient.invalidateQueries();
	}

	return (
		<Sidebar>
			<SidebarHeader className="border-b p-4">
				<div className="flex items-center gap-2">
					<img
						src="/logo_48.png"
						alt="Prime Age Beauty and fitness center"
						className="h-12 w-12"
					/>
					<div>
						<p className="text-sm font-semibold text-primary">Prime Age</p>
						<p className="text-xs text-muted-foreground">
							Beauty and fitness center
						</p>
					</div>
				</div>
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel>Navigation</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{menuItems.map((item) => {
								const recreatedPathName = `${pathname.split("/app")[1]}`;
								// const isActive = recreatedPathName === item.url;
								const isActive = item.url.includes(recreatedPathName);
								return (
									<SidebarMenuItem key={item.title}>
										<SidebarMenuButton
											asChild
											isActive={isActive}
											onClick={() => setOpenMobile(!openMobile)}
											data-testid={`link-${item.title.toLowerCase().replace(/\s/g, "-")}`}
										>
											<Link to={item.url}>
												<item.icon className="size-5!" />
												<span>{item.title}</span>
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
								);
							})}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>
			<SidebarFooter>
				<SidebarGroup>
					<SidebarGroupContent>
						<p className="text-xs text-muted-foreground">Logged In as here</p>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarFooter>
		</Sidebar>
	);
}
