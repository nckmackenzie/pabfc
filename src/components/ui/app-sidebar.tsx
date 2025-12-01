import { Link, useLocation } from "@tanstack/react-router";
import {
	BarChartIcon,
	CalendarIcon,
	ChartPieIcon,
	ChatMessageIcon,
	ConstructionIcon,
	PaymentCardIcon,
	PercentBadgeIcon,
	Users2Icon,
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
import { useSession } from "@/lib/auth/client";
import type { Permission } from "@/lib/permissions/constants";
import { Skeleton } from "./skeleton";

type MenuItem = {
	title: string;
	url: string;
	icon: React.ComponentType<{ className?: string }>;
	permission?: Permission;
	wip?: boolean;
};

const menuItems: MenuItem[] = [
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
		icon: Users2Icon,
	},
	{
		title: "Plans & Packages",
		url: "/app/plans",
		icon: PercentBadgeIcon,
		wip: true,
	},
	{
		title: "Payments & Billing",
		url: "/app/payments",
		icon: PaymentCardIcon,
		wip: true,
	},
	{
		title: "Attendance",
		url: "/app/attendance",
		icon: CalendarIcon,
		wip: true,
	},
	{
		title: "Communication",
		url: "/app/communication",
		icon: ChatMessageIcon,
		wip: true,
	},
	{
		title: "Reports",
		url: "/reports",
		icon: BarChartIcon,
		wip: true,
	},
];

export function AppSidebar() {
	const { pathname } = useLocation();
	const { setOpenMobile, openMobile } = useSidebar();
	const { data, isPending, error } = useSession();

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
								const isActive = pathname.startsWith(item.url);
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
												{item.wip && (
													<ConstructionIcon className="ml-auto size-4! text-muted-foreground" />
												)}
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
						{error && (
							<p className="text-xs text-destructive">
								You need to login again!!
							</p>
						)}
						{isPending && <Skeleton className="h-4 w-56" />}
						{data && (
							<p className="text-xs text-muted-foreground">
								Logged In as:{" "}
								<span className="font-semibold capitalize text-primary">
									{data.user.name.split(" ")[0]}
								</span>
							</p>
						)}
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarFooter>
		</Sidebar>
	);
}
