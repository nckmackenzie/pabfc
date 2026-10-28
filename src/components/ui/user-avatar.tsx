import { Style, Avatar as DicebearAvatar } from "@dicebear/core";
import definition from "@dicebear/styles/initials.json" with { type: "json" };
import { useQueryClient } from "@tanstack/react-query";
import { Link, useRouteContext, useRouter } from "@tanstack/react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ClipboardClockIcon, CogIcon, LogOutIcon, UsersIcon } from "@/components/ui/icons";
import { authClient } from "@/lib/auth/client";

export function UserAvatar() {
	const session = useRouteContext({ from: "/app", select: (context) => context.auth });
	const router = useRouter();
	const queryClient = useQueryClient();

	const style = new Style(definition);
	const avatar = new DicebearAvatar(style, {
		seed: session?.user.name,
	});

	async function handleLogout() {
		await authClient.signOut();
		queryClient.removeQueries({ queryKey: ["auth"] });
		await router.invalidate();
		router.navigate({ to: "/sign-in" });
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					className="hover:bg-transparent focus-visible:ring-[1px]!"
				>
					<Avatar>
						<AvatarImage
							src={session?.user.image ?? avatar.toDataUri()}
							alt={session?.user.name ?? "User"}
						/>
						<AvatarFallback>{session?.user.name?.slice(0, 2).toUpperCase()}</AvatarFallback>
					</Avatar>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-56" align="start">
				<DropdownMenuLabel>My Account</DropdownMenuLabel>
				<DropdownMenuGroup>
					<DropdownMenuItem className="cursor-pointer" asChild>
						<Link to="/app/profile">
							<UsersIcon />
							Your Profile
						</Link>
					</DropdownMenuItem>
					<DropdownMenuItem asChild>
						<Link to="/app/activity-logs">
							<ClipboardClockIcon />
							Activty Logs
						</Link>
					</DropdownMenuItem>
					{session?.user.role === "admin" && (
						<DropdownMenuItem asChild>
							<Link to="/app/settings">
								<CogIcon />
								Settings
							</Link>
						</DropdownMenuItem>
					)}
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuItem onSelect={handleLogout}>
					<LogOutIcon />
					Log out
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
