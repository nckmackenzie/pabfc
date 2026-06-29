import { Link } from "@tanstack/react-router";
import { ConstructionIcon, MinusIcon, PlusIcon } from "@/components/ui/icons";

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
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
	useSidebar,
} from "@/components/ui/sidebar";
import { useSession } from "@/lib/auth/client";
import { collapsibleMenuItems, type MenuItem as MenuItemType, menuItems } from "@/lib/constants";
import type { Route } from "@/types/index.types";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./collapsible";
import { Skeleton } from "./skeleton";
import { usePermissions } from "@/hooks/use-permissions";

export function AppSidebar() {
	const { data, isPending, error } = useSession();
	const { setOpenMobile, openMobile } = useSidebar();
	const { hasPermission, isLoading } = usePermissions();

	return (
		<Sidebar>
			<SidebarHeader className="border-b max-h-16">
				<div className="flex items-center justify-center gap-2">
					<img
						src="/prime_age_horizontal_logo.png"
						alt="Prime Age Beauty and fitness center"
						className="h-12 w-auto"
					/>
					{/* <div>
						<p className="text-sm font-semibold text-primary">Prime Age</p>
						<p className="text-xs text-muted-foreground">
							Beauty and fitness center
						</p>
					</div> */}
				</div>
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup className="pb-0">
					<SidebarGroupLabel>Navigation</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{isLoading
								? menuItems.map((item) => <Skeleton key={item.title} className="h-4 w-44" />)
								: menuItems
										.filter((item) =>
											item.permission ? hasPermission(item.permission) : data?.user.role === "admin"
										)
										.map((item) => <MenuItem key={item.title} item={item} />)}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
				<SidebarGroup className="pt-0">
					<SidebarGroupContent>
						<SidebarMenu>
							{isLoading
								? collapsibleMenuItems.map((item) => (
										<Skeleton key={item.title} className="h-4 w-44" />
									))
								: collapsibleMenuItems.map((item) => {
										const visibleSubItems = item.items.filter((subItem) =>
											hasPermission(subItem.permission)
										);

										if (visibleSubItems.length === 0) return null;

										return (
											<Collapsible key={item.title} asChild className="group/collapsible">
												<SidebarMenuItem>
													<CollapsibleTrigger asChild>
														<SidebarMenuButton className="capitalize" tooltip={item.title}>
															{<item.icon className="text-muted-foreground size-5!" />}
															<span>{item.title}</span>
															<PlusIcon className="ml-auto icon text-muted-foreground group-data-[state=open]/collapsible:hidden" />
															<MinusIcon className="hidden ml-auto icon text-muted-foreground group-data-[state=open]/collapsible:block" />
														</SidebarMenuButton>
													</CollapsibleTrigger>
													<CollapsibleContent>
														<SidebarMenuSub>
															{visibleSubItems.map((subItem) => (
																<SidebarMenuSubItem key={subItem.title}>
																	<SidebarMenuSubButton
																		asChild
																		className="text-xs font-medium text-muted-foreground"
																		onClick={() => setOpenMobile(!openMobile)}
																	>
																		<Link
																			to={`${subItem.url}` as Route}
																			className="capitalize"
																			activeProps={{ "data-active": true }}
																			activeOptions={{ exact: false }}
																		>
																			{subItem.title}
																		</Link>
																	</SidebarMenuSubButton>
																</SidebarMenuSubItem>
															))}
														</SidebarMenuSub>
													</CollapsibleContent>
												</SidebarMenuItem>
											</Collapsible>
										);
									})}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>
			<SidebarFooter>
				<SidebarGroup>
					<SidebarGroupContent>
						{error && <p className="text-xs text-destructive">You need to login again!!</p>}
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

function MenuItem({ item }: { item: MenuItemType }) {
	const { setOpenMobile, openMobile } = useSidebar();
	return (
		<SidebarMenuItem>
			<SidebarMenuButton
				asChild
				onClick={() => setOpenMobile(!openMobile)}
				data-testid={`link-${item.title.toLowerCase().replace(/\s/g, "-")}`}
			>
				<Link to={item.url} activeProps={{ "data-active": true }} activeOptions={{ exact: false }}>
					<item.icon className="size-5! text-muted-foreground" />
					<span>{item.title}</span>
					{item.wip && <ConstructionIcon className="ml-auto size-4! text-muted-foreground" />}
				</Link>
			</SidebarMenuButton>
		</SidebarMenuItem>
	);
}
