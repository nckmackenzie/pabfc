import { useQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	CalendarIcon,
	ChevronDownIcon,
	ConstructionIcon,
	DollarSignIcon,
	PencilIcon,
} from "@/components/ui/icons";
import {
	MemberAvatar,
	MemberBadge,
} from "@/features/members/components/member-table";
import { useMemberActions } from "@/features/members/hooks/use-member-actions";
import type { getMemberProfileData } from "@/features/members/services/members.queries.api";
import { memberQueries } from "@/features/members/services/queries";
import { dateFormat } from "@/lib/helpers";
import { cn, toTitleCase } from "@/lib/utils";

export function MemberProfile() {
	const route = getRouteApi("/app/members/$memberId/profile");
	const memberLoaderData = route.useLoaderData();
	const { data: memberOverview } = useQuery(
		memberQueries.overview(route.useParams().memberId),
	);
	const memberData = memberOverview ?? memberLoaderData;
	const { handleRevokePortalAccess, handleToggleActive } = useMemberActions();

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
							<div className="flex items-center gap-2">
								<MemberBadge status={memberData.memberStatus} />
								{memberData.banned && (
									<MemberBadge
										status={memberData.banned ? "terminated" : "active"}
										textContent={
											memberData.banned
												? "Portal Access Revoked"
												: "Portal Access Active"
										}
									/>
								)}
							</div>
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
							{(memberData.memberStatus === "active" ||
								memberData.memberStatus === "inactive") && (
								<DropdownMenuItem
									onSelect={() =>
										handleToggleActive({
											memberId: memberData.id,
											memberName: memberData.fullName,
											active: memberData.memberStatus === "active",
										})
									}
								>
									{memberData.memberStatus === "active"
										? "Deactivate"
										: "Activate"}
								</DropdownMenuItem>
							)}
							<DropdownMenuItem
								onSelect={() =>
									handleRevokePortalAccess({
										memberId: memberData.id,
										memberName: memberData.fullName,
										banned: memberData.banned,
									})
								}
							>
								{memberData.banned
									? "Restore Portal Access"
									: "Revoke Portal Access"}
							</DropdownMenuItem>
							{/* TODO: Implement */}
							<DropdownMenuItem disabled>
								Send Message <ConstructionIcon />
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>
			<div className="grid md:grid-cols-2 gap-4">
				<PersonalDetails memberData={memberData} />
				<div className="grid gap-4">
					<div className="rounded-md border border-gray-200 p-4 self-start">
						<h2 className="text-base font-bold font-display">
							Payment History
						</h2>
						<div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
							<DollarSignIcon className="size-12" />
							<p className="text-sm mt-2">No payment history found.</p>
						</div>
					</div>
					<div className="rounded-md border border-gray-200 p-4 self-start">
						<h2 className="text-base font-bold font-display">
							Attendance History
						</h2>
						<div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
							<CalendarIcon className="size-12" />
							<p className="text-sm mt-2">No attendance history found.</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

function PersonalDetails({
	memberData,
}: {
	memberData: Awaited<ReturnType<typeof getMemberProfileData>>;
}) {
	return (
		<div className="rounded-md border border-gray-200 p-4">
			<div className="space-y-2">
				<div className="flex items-center gap-2">
					<h2 className="text-base font-bold font-display">Personal Info</h2>
				</div>
				<div className="grid grid-cols-2 gap-x-8 gap-y-4 md:gap-x-12">
					<MemberInfo label="First Name" value={memberData.firstName} />
					<MemberInfo label="Last Name" value={memberData.lastName} />
					<MemberInfo label="Gender" value={memberData.gender} />
					<MemberInfo label="Contact" value={memberData.contact} />
					<MemberInfo label="Member Status" value={memberData.memberStatus} />
					<MemberInfo
						label="Last Visit"
						value={memberData.lastVisit?.toString()}
					/>
					<MemberInfo
						label="Emergency Contact Name"
						value={memberData.emergencyContactName}
					/>
					<MemberInfo
						label="Emergency Contact No"
						value={memberData.emergencyContactNo}
					/>
					<MemberInfo label="Active Plan" value={memberData.activePlanName} />
					<MemberInfo
						label="Next Renewal Date"
						value={memberData.nextRenewalDate?.toString()}
					/>

					<MemberInfo
						className="col-span-2"
						label="Notes"
						value={memberData.notes}
					/>
				</div>
			</div>
		</div>
	);
}

function MemberInfo({
	label,
	value,
	className,
}: {
	label: string;
	value?: string | null;
	className?: string;
}) {
	return (
		<div className={cn("grid gap-0.5", className)}>
			<h3 className="text-muted-foreground text-xs">{label}</h3>
			<p className="text-sm capitalize font-medium">{value || "-"}</p>
		</div>
	);
}
