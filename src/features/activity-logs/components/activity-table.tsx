import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, useRouteContext } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { DataTable } from "@/components/ui/datatable";
import {
	AndroidIcon,
	AppleIcon,
	DotIcon,
	LinuxIcon,
	MonitorIcon,
	MonitorPhoneIcon,
	WindowsIcon,
} from "@/components/ui/icons";
// import type { getActivityLogs } from "@/features/activity-logs/services/logs.api";
import { activityLogsQueries } from "@/features/activity-logs/services/queries";
import { MemberAvatar } from "@/features/members/components/member-table";
import { useFilters } from "@/hooks/use-filters";
import { toTitleCase } from "@/lib/utils";

export function ActivtyTable() {
	const user = useRouteContext({
		from: "/app/activity-logs/",
		select: (context) => context.userSession?.user,
	});
	const { filters } = useFilters(getRouteApi("/app/activity-logs/").id);
	const { data: logs } = useSuspenseQuery(activityLogsQueries.list(filters));

	if (!user) return null;

	const columns: Array<ColumnDef<(typeof logs)[number]>> = [
		{
			accessorKey: "action",
			header: "Action",
			cell: ({ row }) => toTitleCase(row.original.action),
		},
		{
			accessorKey: "timestamp",
			header: "Timestamp",
			cell: ({ row }) =>
				format(new Date(row.original.timestamp), "dd/MM/yyyy HH:mm:ss"),
		},
		{
			accessorKey: user.role === "admin" ? "user" : "userAgent",
			header: user.role === "admin" ? "User" : "Device",
			cell: ({ row }) => {
				const os = row.original.os;
				const browser = row.original.userAgent;
				if (user.role === "admin") {
					return (
						<div className="flex items-center gap-2">
							<MemberAvatar
								memberName={row.original.user}
								image={row.original.userImage}
							/>
							<span className="font-medium text-sm capitalize">
								{row.original.user}
							</span>
						</div>
					);
				}
				return (
					<div className="flex items-center gap-2">
						<div className="flex items-center gap-1">
							{os === "Windows" ? (
								<WindowsIcon className="size-4 text-muted-foreground" />
							) : os === "Android" ? (
								<AndroidIcon className="size-4 text-muted-foreground" />
							) : os === "iOS" ? (
								<AppleIcon className="size-4 text-muted-foreground" />
							) : os === "macOS" ? (
								<AppleIcon className="size-4 text-muted-foreground" />
							) : os === "Linux" ? (
								<LinuxIcon className="size-4 text-muted-foreground" />
							) : (
								<MonitorPhoneIcon className="size-4 text-muted-foreground" />
							)}

							<span className="font-medium text-sm capitalize">{os}</span>
						</div>
						<DotIcon className="size-3 text-muted-foreground" />
						<div className="flex items-center gap-1">
							<MonitorIcon className="size-4 text-muted-foreground" />
							<span className="font-medium text-sm capitalize">{browser}</span>
						</div>
					</div>
				);
			},
		},
		{
			accessorKey: "details",
			header: "Details",
			cell: ({ row }) => toTitleCase(row.original.details),
		},
	];

	return <DataTable columns={columns} data={logs} />;
}
