import { initials } from "@dicebear/collection";
import { createAvatar } from "@dicebear/core";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
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
import {
	BellIcon,
	ClipboardClockIcon,
	CogIcon,
	ConstructionIcon,
	LogOutIcon,
	UsersIcon,
} from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient, useSession } from "@/lib/auth/client";

export function UserAvatar() {
	// TODO: Add user profile, notifications, activity logs, and settings
	const { data: session, isPending } = useSession();
	const router = useRouter();
	const queryClient = useQueryClient();
	if (isPending) {
		return <Skeleton className="size-8 bg-secondary" />;
	}

	const avatar = createAvatar(initials, {
		seed: session?.user.name,
	});

	async function handleLogout() {
		await authClient.signOut();
		router.navigate({ to: "/sign-in" });
		router.invalidate();
		await queryClient.invalidateQueries();
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
						<AvatarFallback>
							{session?.user.name?.slice(0, 2).toUpperCase()}
						</AvatarFallback>
					</Avatar>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-56" align="start">
				<DropdownMenuLabel>My Account</DropdownMenuLabel>
				<DropdownMenuGroup>
					<DropdownMenuItem className="cursor-pointer" disabled>
						<UsersIcon />
						Your Profile
						<ConstructionIcon className="ml-auto" />
					</DropdownMenuItem>

					<DropdownMenuItem disabled>
						<BellIcon />
						Notifications
						<ConstructionIcon className="ml-auto" />
					</DropdownMenuItem>
					<DropdownMenuItem asChild>
						<Link to="/app/activity-logs">
							<ClipboardClockIcon />
							Activty Logs
						</Link>
					</DropdownMenuItem>
					{session?.user.role === "admin" && (
						<DropdownMenuItem disabled>
							<CogIcon />
							Settings
							<ConstructionIcon className="ml-auto" />
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
