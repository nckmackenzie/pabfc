import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { DataTable } from "@/components/ui/datatable";
import { DatatableActions } from "@/components/ui/datatable-actions";
import { DataTableColumnHeader } from "@/components/ui/datatable-column-header";
import { DeleteActionButton } from "@/components/ui/delete-action";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { EditAction, ViewDetailsAction } from "@/components/ui/custom-button";
import { EmptyState } from "@/components/ui/empty";
import { PhoneIcon } from "@/components/ui/icons";
import { PermissionGate } from "@/components/ui/permission-gate";
import { EnquiryStatusBadge } from "@/features/enquiries/components/enquiry-status-badge";
import { FollowUpDate } from "@/features/enquiries/components/follow-up-date";
import { useEnquiryActions } from "@/features/enquiries/hooks/use-enquiry-actions";
import { enquirySourceLabel } from "@/features/enquiries/lib/constants";
import {
	allowedManualTransitions,
	isConversionStatus,
} from "@/features/enquiries/lib/enquiry-status";
import { enquiryFullName } from "@/features/enquiries/lib/helpers";
import { deleteEnquiry } from "@/features/enquiries/services/enquiries.mutations.api";
import type { EnquiryListItem } from "@/features/enquiries/services/enquiries.queries.api";
import { enquiryQueries } from "@/features/enquiries/services/queries";
import { useFilters } from "@/hooks/use-filters";

export function EnquiryTable() {
	const { filters } = useFilters(getRouteApi("/app/enquiries/").id);
	const { data } = useSuspenseQuery(enquiryQueries.list(filters));
	const { handleMarkContacted, handleMarkLost, handleReopen } = useEnquiryActions();

	const columns: Array<ColumnDef<EnquiryListItem>> = [
		{
			id: "name",
			accessorFn: ({ firstName, lastName }) => enquiryFullName(firstName, lastName),
			header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
			cell: ({ row }) => (
				<Link
					to="/app/enquiries/$enquiryId"
					params={{ enquiryId: row.original.id }}
					className="font-medium hover:underline"
				>
					{enquiryFullName(row.original.firstName, row.original.lastName)}
				</Link>
			),
		},
		{
			accessorKey: "phone",
			header: ({ column }) => <DataTableColumnHeader column={column} title="Phone" />,
		},
		{
			accessorKey: "source",
			header: ({ column }) => <DataTableColumnHeader column={column} title="Source" />,
			cell: ({ row }) => enquirySourceLabel(row.original.source),
		},
		{
			accessorKey: "interestedPlanName",
			header: ({ column }) => <DataTableColumnHeader column={column} title="Interested Plan" />,
			cell: ({ row }) => row.original.interestedPlanName ?? "-",
		},
		{
			accessorKey: "status",
			header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
			cell: ({ row }) => <EnquiryStatusBadge status={row.original.status} />,
		},
		{
			accessorKey: "followUpDate",
			header: ({ column }) => <DataTableColumnHeader column={column} title="Follow-up" />,
			cell: ({ row }) => (
				<FollowUpDate followUpDate={row.original.followUpDate} status={row.original.status} />
			),
		},
		{
			accessorKey: "assignedEmployeeName",
			header: ({ column }) => <DataTableColumnHeader column={column} title="Assigned To" />,
			cell: ({ row }) => row.original.assignedEmployeeName ?? "-",
		},
		{
			accessorKey: "createdAt",
			header: ({ column }) => <DataTableColumnHeader column={column} title="Created" />,
			cell: ({ row }) => format(new Date(row.original.createdAt), "dd MMM yyyy"),
		},
		{
			id: "actions",
			cell: ({ row: { original } }) => {
				const name = enquiryFullName(original.firstName, original.lastName);
				const next = allowedManualTransitions(original.status);
				const canMarkContacted = next.includes("contacted") && original.status === "new";
				const canReopen = original.status === "lost";
				const canMarkLost = next.includes("lost");

				return (
					<DatatableActions>
						<DropdownMenuItem asChild>
							<Link to="/app/enquiries/$enquiryId" params={{ enquiryId: original.id }}>
								<ViewDetailsAction text="View" />
							</Link>
						</DropdownMenuItem>
						<PermissionGate permission="enquiries:update">
							<DropdownMenuItem asChild>
								<Link to="/app/enquiries/$enquiryId/edit" params={{ enquiryId: original.id }}>
									<EditAction />
								</Link>
							</DropdownMenuItem>
							{canMarkContacted && (
								<DropdownMenuItem onSelect={() => handleMarkContacted(original.id)}>
									<PhoneIcon className="size-4" />
									<span className="-ml-1">Mark contacted</span>
								</DropdownMenuItem>
							)}
							{canReopen && (
								<DropdownMenuItem onSelect={() => handleReopen(original.id)}>
									<PhoneIcon className="size-4" />
									<span className="-ml-1">Reopen</span>
								</DropdownMenuItem>
							)}
							{canMarkLost && (
								<DropdownMenuItem
									onSelect={() => handleMarkLost({ enquiryId: original.id, enquiryName: name })}
								>
									<span className="ml-1">Mark lost</span>
								</DropdownMenuItem>
							)}
						</PermissionGate>
						{!isConversionStatus(original.status) && (
							<PermissionGate permission="enquiries:delete">
								<DeleteActionButton
									queryKey={[...enquiryQueries.all]}
									resourceId={original.id}
									deleteAction={deleteEnquiry}
									successMessage="Enquiry deleted"
								/>
							</PermissionGate>
						)}
					</DatatableActions>
				);
			},
		},
	];

	if (data.length === 0) {
		return (
			<EmptyState
				title="No Enquiries"
				description="No enquiries match these filters. Log a new one when someone asks about membership."
				path="/app/enquiries/new"
				icon={<PhoneIcon />}
				buttonName="Log Enquiry"
			/>
		);
	}

	return <DataTable columns={columns} data={data} />;
}
