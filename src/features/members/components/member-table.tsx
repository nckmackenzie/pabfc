import { initials } from "@dicebear/collection";
import { createAvatar } from "@dicebear/core";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { formatDistanceToNow } from "date-fns";
import { nanoid } from "nanoid";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { EditAction } from "@/components/ui/custom-button";
import { DataTable } from "@/components/ui/datatable";
import { DatatableActions } from "@/components/ui/datatable-actions";
import { DataTableColumnHeader } from "@/components/ui/datatable-column-header";
import { DeleteActionButton } from "@/components/ui/delete-action";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty";
import {
	ChatMessageIcon,
	CheckCircleIcon,
	MonitorPhoneIcon,
	NoSymbolIcon,
	PauseIcon,
	Users2Icon,
	UsersIcon,
	XCircleIcon,
} from "@/components/ui/icons";
import { PermissionGate } from "@/components/ui/permission-gate";
import { Skeleton } from "@/components/ui/skeleton";
import type { MemberOverview } from "@/features/members/services/members.queries.api";
import { memberQueries } from "@/features/members/services/queries";
import { useFilters } from "@/hooks/use-filters";
import { cn, toTitleCase } from "@/lib/utils";
import { useMemberActions } from "../hooks/use-member-actions";

export function MemberTable() {
	const { filters } = useFilters(getRouteApi("/app/members/").id);
	const { data } = useSuspenseQuery(memberQueries.list(filters));
	const { handleRevokePortalAccess, handleToggleActive, handleSendMessage } =
		useMemberActions();

	const columns: Array<ColumnDef<MemberOverview>> = [
		{
			accessorKey: "memberNo",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Member No" />
			),
		},
		{
			accessorKey: "fullName",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Full Name" />
			),
			cell: ({ row }) => {
				const member = row.original;
				return (
					<div className="flex items-center gap-2">
						<MemberAvatar memberName={member.fullName} image={member.image} />
						<span>{toTitleCase(member.fullName)}</span>
					</div>
				);
			},
		},
		{
			accessorKey: "memberStatus",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Member Status" />
			),
			cell: ({
				row: {
					original: { memberStatus },
				},
			}) => {
				return <MemberBadge status={memberStatus} />;
			},
		},
		{
			accessorKey: "activePlanName",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Active Plan" />
			),
			cell: ({
				row: {
					original: { activePlanName },
				},
			}) => (
				<Badge variant={activePlanName ? "success" : "secondary"}>
					{activePlanName ?? "No active plan"}
				</Badge>
			),
		},
		{
			accessorKey: "nextRenewalDate",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Next Renewal Date" />
			),
			cell: ({
				row: {
					original: { nextRenewalDate },
				},
			}) => (
				<Badge variant={nextRenewalDate ? "success" : "secondary"}>
					{nextRenewalDate ?? "No active plan"}
				</Badge>
			),
		},
		{
			accessorKey: "lastVisit",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Last Visit" />
			),
			cell: ({
				row: {
					original: { lastVisit },
				},
			}) => (
				<Badge variant={lastVisit ? "secondary" : "info"}>
					{lastVisit
						? formatDistanceToNow(new Date(lastVisit), { addSuffix: true })
						: "No visits yet"}
				</Badge>
			),
		},
		{
			accessorKey: "portalAccess",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Portal Access" />
			),
			cell: ({
				row: {
					original: { portalAccess },
				},
			}) => (
				<div className="flex items-center justify-center">
					<Checkbox checked={!portalAccess} />
				</div>
			),
		},
		{
			id: "actions",
			cell: ({
				row: {
					original: { id, memberStatus, portalAccess, fullName },
				},
			}) => (
				<DatatableActions>
					<PermissionGate
						permission="members:update"
						loadingComponent={<Skeleton className="h-4 w-32" />}
					>
						<DropdownMenuItem asChild>
							<Link to="/app/members/$memberId/edit" params={{ memberId: id }}>
								<EditAction />
							</Link>
						</DropdownMenuItem>
					</PermissionGate>
					<PermissionGate permission="members:view-profile">
						<DropdownMenuItem asChild>
							<Link
								to="/app/members/$memberId/profile"
								params={{ memberId: id }}
								search={{ vid: nanoid() }}
							>
								<Users2Icon className="size-4" />
								<span className="-ml-1">View Profile</span>
							</Link>
						</DropdownMenuItem>
					</PermissionGate>
					<DropdownMenuItem
						onSelect={() =>
							handleSendMessage({ memberId: id, memberName: fullName })
						}
					>
						<ChatMessageIcon className="size-4" />
						<span className="-ml-1">Send Message</span>
					</DropdownMenuItem>
					{memberStatus !== "terminated" && (
						<DropdownMenuItem
							onSelect={() =>
								handleToggleActive({
									memberId: id,
									memberName: fullName,
									active: memberStatus === "active",
								})
							}
						>
							<Users2Icon className="size-4" />
							<span className="-ml-1">
								{memberStatus === "active" ? "Deactivate" : "Activate"}
							</span>
						</DropdownMenuItem>
					)}
					<DropdownMenuItem
						onSelect={() =>
							handleRevokePortalAccess({
								memberId: id,
								memberName: fullName,
								banned: portalAccess,
							})
						}
					>
						<MonitorPhoneIcon className="size-4" />
						<span className="-ml-1">
							{!portalAccess ? "Revoke" : "Grant"} Portal Access
						</span>
					</DropdownMenuItem>
					<DeleteActionButton
						queryKey={["members"]}
						resourceId={id}
						deleteAction={async () => {}}
					/>
				</DatatableActions>
			),
		},
	];

	if (data.length === 0) {
		return (
			<EmptyState
				title="No Members"
				description="You have no members yet! Lets create some.."
				path="/app/members/new"
				icon={<UsersIcon />}
				buttonName="Add Member"
			/>
		);
	}

	return <DataTable columns={columns} data={data} />;
}

export function MemberAvatar({
	memberName,
	image,
	className,
}: {
	memberName: string;
	image?: string | null;
	className?: string;
}) {
	const avatar = createAvatar(initials, {
		seed: memberName,
		size: 24,
	});
	return (
		<Avatar className={cn("h-8 w-8", className)}>
			<AvatarImage src={image ?? avatar.toDataUri()} alt={memberName} />
			<AvatarFallback>{memberName.charAt(0).toUpperCase()}</AvatarFallback>
		</Avatar>
	);
}

export function MemberBadge({
	status,
	textContent,
}: {
	status: MemberOverview["memberStatus"];
	textContent?: string;
}) {
	return (
		<Badge
			variant={
				status === "active"
					? "success"
					: status === "terminated"
						? "danger"
						: status === "inactive"
							? "warning"
							: "secondary"
			}
		>
			{status === "active" ? (
				<CheckCircleIcon className="size-4!" />
			) : status === "inactive" ? (
				<NoSymbolIcon className="size-4!" />
			) : status === "terminated" ? (
				<XCircleIcon className="size-4!" />
			) : (
				<PauseIcon className="size-4!" />
			)}
			{toTitleCase(textContent ?? status)}
		</Badge>
	);
}
