import { useSuspenseQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { ClockIcon, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/datatable";
import { CheckIcon, XIcon } from "@/components/ui/icons";
import { Wrapper } from "@/components/ui/wrapper";
import type { getSmsBroadcasts } from "@/features/communication/services/communication.api";
import { smsBroadcastQueries } from "@/features/communication/services/queries";
import { currencyFormatter } from "@/lib/helpers";

type SMSBroadcast = Awaited<ReturnType<typeof getSmsBroadcasts>>[number];

const columns: Array<ColumnDef<SMSBroadcast>> = [
	{
		accessorKey: "sentAt",
		header: "Sent At",
		cell: ({ row }) =>
			format(row.original.sentAt ?? new Date(), "dd/MM/yyyy HH:mm:ss"),
	},
	{
		accessorKey: "receipients",
		header: "Sent to",
		cell: ({
			row: {
				original: { receipients },
			},
		}) =>
			`${receipients.length} ${receipients.length === 1 ? "member" : "members"}`,
	},
	{
		accessorKey: "totalCost",
		header: "Total Cost",
		cell: ({
			row: {
				original: { totalCost },
			},
		}) => currencyFormatter(totalCost ?? 0),
	},
	{
		id: "success/failure",
		header: "Success/Failure",
		cell: ({
			row: {
				original: { totalSuccess, totalFailed },
			},
		}) => `${totalSuccess}/${totalFailed}`,
	},
	{
		accessorKey: "smsBroadcastStatus",
		header: "Status",
		cell: ({ row }) => {
			const status = row.original.smsBroadcastStatus;
			return (
				<Badge
					variant={
						status === "sent"
							? "success"
							: status === "draft"
								? "outline"
								: status === "failed"
									? "destructive"
									: "info"
					}
					className="capitalize flex items-center gap-2"
				>
					{status === "sending" ? (
						<Loader2 className="animate-spin" />
					) : status === "failed" ? (
						<XIcon />
					) : status === "sent" ? (
						<CheckIcon />
					) : (
						<ClockIcon />
					)}
					{status}
				</Badge>
			);
		},
	},
];

export const Broadcasts = () => {
	const { data } = useSuspenseQuery({
		...smsBroadcastQueries.list(),
		refetchInterval: 5000,
	});
	return (
		<Wrapper className="space-y-4">
			<header className="flex items-center justify-between">
				<div className="space-y-0.5">
					<h2 className="text-lg font-semibold font-display">
						Recent Broadcasts
					</h2>
					<p className="text-muted-foreground text-xs">Track your broadcasts</p>
				</div>
			</header>
			<DataTable data={data} columns={columns} />
		</Wrapper>
	);
};
