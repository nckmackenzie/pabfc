import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { ActionButton } from "@/components/ui/action-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/datatable";
import { PermissionGate } from "@/components/ui/permission-gate";
import { RejectComplimentaryRequestModal } from "@/features/receipts/components/reject-complimentary-request-modal";
import { approveComplimentaryRequestFn } from "@/features/receipts/services/complimentary.mutations.api";
import { complimentaryQueries } from "@/features/receipts/services/complimentary.queries";
import { useModal } from "@/integrations/modal-provider";
import { useSession } from "@/lib/auth/client";
import { dateFormat } from "@/lib/helpers";
import { success } from "@/lib/result";
import { toTitleCase } from "@/lib/utils";

export function ComplimentaryRequestsTable() {
	const { data: requests } = useSuspenseQuery(complimentaryQueries.list({ status: "all" }));
	const { data: session } = useSession();

	const columns: Array<ColumnDef<(typeof requests)[0]>> = [
		{
			accessorKey: "member",
			header: "Member",
			cell: ({ row }) =>
				toTitleCase(`${row.original.member.firstName} ${row.original.member.lastName}`),
		},
		{
			accessorKey: "plan",
			header: "Plan",
			cell: ({ row }) => toTitleCase(row.original.plan.name),
		},
		{
			accessorKey: "requestedByUser",
			header: "Requested By",
			cell: ({ row }) => row.original.requestedByUser.name,
		},
		{
			accessorKey: "createdAt",
			header: "Requested Date",
			cell: ({ row }) => dateFormat(row.original.createdAt, "long"),
		},
		{
			accessorKey: "status",
			header: "Status",
			cell: ({ row }) => (
				<Badge
					variant={
						row.original.status === "approved"
							? "success"
							: row.original.status === "rejected"
								? "destructive"
								: "info"
					}
					className="capitalize"
				>
					{row.original.status}
				</Badge>
			),
		},
		{
			accessorKey: "reviewedByUser",
			header: "Reviewed By",
			cell: ({ row }) =>
				row.original.reviewedByUser
					? `${row.original.reviewedByUser.name} on ${dateFormat(row.original.reviewedAt ?? new Date(), "long")}`
					: "—",
		},
		{
			id: "actions",
			cell: ({ row }) =>
				row.original.status === "pending" && row.original.requestedByUserId !== session?.user.id ? (
					<PermissionGate permission="receipts:complimentary-approve">
						<RequestActions requestId={row.original.id} />
					</PermissionGate>
				) : null,
		},
	];

	return <DataTable columns={columns} data={requests} />;
}

function RequestActions({ requestId }: { requestId: string }) {
	const queryClient = useQueryClient();
	const { setOpen } = useModal();

	return (
		<div className="flex items-center gap-2">
			<ActionButton
				variant="outline"
				size="sm"
				requireAreYouSure
				isDestructive={false}
				areYouSureDescription="This creates a KES 0 payment and activates the membership immediately."
				action={async () => {
					const result = await approveComplimentaryRequestFn({ data: requestId });
					if (!result.success) return result;
					queryClient.invalidateQueries({ queryKey: complimentaryQueries.all });
					queryClient.invalidateQueries({ queryKey: ["receipts"] });
					queryClient.invalidateQueries({ queryKey: ["members"] });
					return success(undefined);
				}}
			>
				Approve
			</ActionButton>
			<Button
				variant="destructive"
				size="sm"
				onClick={() => setOpen(<RejectComplimentaryRequestModal requestId={requestId} />)}
			>
				Reject
			</Button>
		</div>
	);
}
