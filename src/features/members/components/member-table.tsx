import { initials } from "@dicebear/collection";
import { createAvatar } from "@dicebear/core";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/datatable";
import { DataTableColumnHeader } from "@/components/ui/datatable-column-header";
import { EmptyState } from "@/components/ui/empty";
import { UsersIcon } from "@/components/ui/icons";
import type { MemberOverview } from "@/features/members/services/members.queries.api";
import { memberQueries } from "@/features/members/services/queries";
import { useFilters } from "@/hooks/use-filters";
import { cn, toTitleCase } from "@/lib/utils";

export function MemberTable() {
	const { filters } = useFilters(getRouteApi("/app/members/").id);
	const { data } = useSuspenseQuery(memberQueries.list(filters));

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
						<span>{member.fullName}</span>
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
				return (
					<Badge
						variant={
							memberStatus === "active"
								? "success"
								: memberStatus === "terminated"
									? "danger"
									: memberStatus === "inactive"
										? "warning"
										: "secondary"
						}
					>
						{toTitleCase(memberStatus)}
					</Badge>
				);
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

function MemberAvatar({
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
	});
	return (
		<Avatar className={cn("h-8 w-8", className)}>
			<AvatarImage src={image ?? avatar.toDataUri()} alt={memberName} />
			<AvatarFallback>{memberName.charAt(0).toUpperCase()}</AvatarFallback>
		</Avatar>
	);
}
