import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import toast from "react-hot-toast";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/datatable";
import { PermissionGate } from "@/components/ui/permission-gate";
import { ToastContent } from "@/components/ui/toast-content";
import { formatText } from "@/features/employees/utils/helpers";
import { leaveQueries } from "@/features/leaves/services/queries";
import type { LeaveRequestListFilters } from "@/features/leaves/utils/schemas";
import {
  approveLeaveRequestFn,
  cancelLeaveRequestFn,
  type LeaveRequestListItem,
  rejectLeaveRequestFn,
} from "@/features/leaves/services/leave.api";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { CustomDropdownTrigger } from "@/components/ui/custom-dropdown-trigger";
import { CustomDropdownContent } from "@/components/ui/custom-dropdown-content";
import { dateFormat } from "@/lib/helpers";
import { toTitleCase } from "@/lib/utils";
import { CheckIcon, XIcon } from "@/components/ui/icons";
import { RotateCcwIcon } from "lucide-react";

const statusVariantMap = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  cancelled: "secondary",
} as const;

type LeaveRequestsTableProps = {
  filters: LeaveRequestListFilters;
};

export function LeaveRequestsTable({ filters }: LeaveRequestsTableProps) {
  const { data } = useSuspenseQuery(leaveQueries.list(filters));
  const queryClient = useQueryClient();

  const invalidateLeaveData = () => {
    queryClient.invalidateQueries({ queryKey: ["leaves"] });
  };

  const approveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const result = await approveLeaveRequestFn({
        data: { requestId },
      });

      if (!result.success) {
        throw new Error(result.error.message);
      }
    },
    onSuccess: () => {
      invalidateLeaveData();
      toast.success((t) => (
        <ToastContent
          t={t}
          title="Request approved"
          message="The leave request has been approved successfully."
        />
      ));
    },
    onError: (error) => {
      toast.error((t) => (
        <ToastContent
          t={t}
          title="Approval failed"
          message={error instanceof Error ? error.message : "Failed to approve request"}
        />
      ));
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({
      requestId,
      rejectionReason,
    }: {
      requestId: string;
      rejectionReason: string;
    }) => {
      const result = await rejectLeaveRequestFn({
        data: { requestId, rejectionReason },
      });

      if (!result.success) {
        throw new Error(result.error.message);
      }
    },
    onSuccess: () => {
      invalidateLeaveData();
      toast.success((t) => (
        <ToastContent
          t={t}
          title="Request rejected"
          message="The leave request has been rejected."
        />
      ));
    },
    onError: (error) => {
      toast.error((t) => (
        <ToastContent
          t={t}
          title="Rejection failed"
          message={error instanceof Error ? error.message : "Failed to reject request"}
        />
      ));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const result = await cancelLeaveRequestFn({
        data: { requestId },
      });

      if (!result.success) {
        throw new Error(result.error.message);
      }
    },
    onSuccess: () => {
      invalidateLeaveData();
      toast.success((t) => (
        <ToastContent
          t={t}
          title="Request cancelled"
          message="The leave request has been cancelled."
        />
      ));
    },
    onError: (error) => {
      toast.error((t) => (
        <ToastContent
          t={t}
          title="Cancellation failed"
          message={error instanceof Error ? error.message : "Failed to cancel request"}
        />
      ));
    },
  });

  const columns: Array<ColumnDef<LeaveRequestListItem>> = [
    {
      accessorKey: "employeeName",
      header: "Employee",
      cell: ({ row }) => formatText(row.original.employeeName),
    },
    {
      accessorKey: "leaveType",
      header: "Leave Type",
      cell: ({ row }) => toTitleCase(row.original.leaveType),
    },
    {
      accessorKey: "startDate",
      header: "Start Date",
      cell: ({ row }) => dateFormat(new Date(row.original.startDate), "long"),
    },
    {
      accessorKey: "endDate",
      header: "End Date",
      cell: ({ row }) => dateFormat(new Date(row.original.endDate), "long"),
    },
    {
      accessorKey: "workingDaysRequested",
      header: "Days",
      cell: ({ row }) => <div className="font-medium">{row.original.workingDaysRequested}</div>,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={statusVariantMap[row.original.status]} className="uppercase">
          {row.original.status}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const request = row.original;

        return (
          <DropdownMenu>
            <CustomDropdownTrigger />
            <CustomDropdownContent>
              {request.status === "pending" && (
                <PermissionGate permissions={["leaves:approve"]}>
                  <DropdownMenuItem
                    onClick={() => approveMutation.mutate(request.id)}
                    disabled={approveMutation.isPending}
                  >
                    <CheckIcon className="size-4!" />
                    Approve
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => {
                      const rejectionReason = window.prompt("Enter a rejection reason");

                      if (!rejectionReason?.trim()) {
                        return;
                      }

                      rejectMutation.mutate({
                        requestId: request.id,
                        rejectionReason,
                      });
                    }}
                    disabled={rejectMutation.isPending}
                  >
                    <XIcon className="size-4! text-destructive" />
                    Reject
                  </DropdownMenuItem>
                </PermissionGate>
              )}
              {(request.status === "pending" || request.status === "approved") && (
                <PermissionGate permissions={["leaves:update"]}>
                  <DropdownMenuItem
                    onClick={() => cancelMutation.mutate(request.id)}
                    disabled={cancelMutation.isPending}
                  >
                    <RotateCcwIcon />
                    Cancel
                  </DropdownMenuItem>
                </PermissionGate>
              )}
            </CustomDropdownContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return <DataTable columns={columns} data={data.items} />;
}
