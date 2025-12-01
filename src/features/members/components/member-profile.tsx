import { getRouteApi, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDownIcon, PencilIcon } from "@/components/ui/icons";
import {
	MemberAvatar,
	MemberBadge,
} from "@/features/members/components/member-table";
import { dateFormat } from "@/lib/helpers";
import { toTitleCase } from "@/lib/utils";

export function MemberProfile() {
	const route = getRouteApi("/app/members/$memberId/profile");
	const memberData = route.useLoaderData();
	return (
		<div className="space-y-6">
			<div className="bg-background border border-gray-200 p-4 rounded-md flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
				<div className="flex items-center gap-2">
					<MemberAvatar
						image={memberData.image}
						memberName={`${memberData.firstName} ${memberData.lastName}`}
						className="size-12"
					/>
					<div className="space-y-0.5">
						<div className="flex items-center gap-2">
							<h1 className="text-base md:text-lg font-bold">
								{toTitleCase(`${memberData.firstName} ${memberData.lastName}`)}
							</h1>
							<MemberBadge status={memberData.memberStatus} />
						</div>
						<div className="text-muted-foreground">
							<span className="text-sm">Member No: {memberData.memberNo}</span>

							<span className="text-sm hidden md:inline-block ">
								&nbsp;•&nbsp;Date Joined:{" "}
								{dateFormat(memberData.createdAt, "long")}
							</span>
						</div>
					</div>
				</div>
				<div className="flex flex-col md:flex-row gap-2">
					<Button variant="default" asChild>
						<Link
							to="/app/members/$memberId/edit"
							params={{ memberId: memberData.id }}
						>
							<PencilIcon />
							Edit Profile
						</Link>
					</Button>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline">
								More
								<ChevronDownIcon />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent>
							<DropdownMenuItem>Deactivate</DropdownMenuItem>
							<DropdownMenuItem>Revoke Portal Access</DropdownMenuItem>
							<DropdownMenuItem>Send Message</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>
			<div className="grid md:grid-cols-2 gap-4">
				<div>
					<h2>Personal Info</h2>
				</div>
				<div>
					<h2>Membership Info</h2>
				</div>
			</div>
		</div>
	);
}
