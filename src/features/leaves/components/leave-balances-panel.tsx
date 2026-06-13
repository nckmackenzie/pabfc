import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, useLoaderData } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import toast from "react-hot-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/datatable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToastContent } from "@/components/ui/toast-content";
import { useFilters } from "@/hooks/use-filters";
import { adjustLeaveBalanceFn, type LeaveBalanceSummaryItem } from "../services/leave.api";
import { leaveQueries } from "../services/queries";
import { toTitleCase } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { formatText } from "@/features/employees/utils/helpers";
import { ErrorBoundaryWithSuspense } from "@/components/ui/error-boundary-with-suspense";
import { DatatableSkeleton } from "@/components/ui/loaders";
import type { LeaveBalanceViewParams } from "../utils/schemas";

export function LeaveBalancesPanel() {
  const { filters, setFilters } = useFilters(getRouteApi("/app/leaves/balances").id);
  const employees = useLoaderData({ from: "/app/leaves/balances" });

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
        <Select
          value={filters.employeeId ?? ""}
          onValueChange={(employeeId) => setFilters({ employeeId })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select employee" />
          </SelectTrigger>
          <SelectContent>
            {employees.map((employee) => (
              <SelectItem key={employee.id} value={employee.id}>
                {toTitleCase(employee.fullName)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="number"
          value={filters.leaveYear ?? new Date().getFullYear()}
          onChange={(event) => setFilters({ leaveYear: Number(event.target.value) || undefined })}
          min={2000}
          max={9999}
        />
      </div>
      <ErrorBoundaryWithSuspense
        loader={<DatatableSkeleton />}
        errorMessage="Failed to load leave balances"
      >
        <SuspendedDatatable filters={filters} />
      </ErrorBoundaryWithSuspense>
    </div>
  );
}

function SuspendedDatatable({ filters }: { filters: LeaveBalanceViewParams }) {
  const { data: balances } = useSuspenseQuery(
    leaveQueries.balances({
      employeeId: filters.employeeId,
      leaveYear: filters.leaveYear,
    })
  );

  const queryClient = useQueryClient();

  const adjustmentMutation = useMutation({
    mutationFn: async ({
      leaveType,
      adjustmentDays,
      reason,
    }: {
      leaveType: LeaveBalanceSummaryItem["leaveType"];
      adjustmentDays: number;
      reason: string;
    }) => {
      if (!filters.employeeId || !filters.leaveYear) {
        throw new Error("Select an employee and leave year first");
      }

      const result = await adjustLeaveBalanceFn({
        data: {
          employeeId: filters.employeeId,
          leaveType,
          leaveYear: filters.leaveYear,
          adjustmentDays,
          reason,
        },
      });

      if (!result.success) {
        throw new Error(result.error.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leaves"] });
      toast.success((t) => (
        <ToastContent
          t={t}
          title="Balance adjusted"
          message="The leave balance adjustment has been saved."
        />
      ));
    },
    onError: (error) => {
      toast.error((t) => (
        <ToastContent
          t={t}
          title="Adjustment failed"
          message={error instanceof Error ? error.message : "Failed to adjust balance"}
        />
      ));
    },
  });

  const columns: Array<ColumnDef<LeaveBalanceSummaryItem>> = [
    {
      accessorKey: "leaveType",
      header: "Leave Type",
      cell: ({ row }) => formatText(row.original.leaveType),
    },
    {
      accessorKey: "entitledDays",
      header: "Entitled",
    },
    {
      accessorKey: "carriedForwardDays",
      header: "Carry Forward",
    },
    {
      accessorKey: "adjustmentDays",
      header: "Adjustments",
    },
    {
      accessorKey: "takenDays",
      header: "Taken",
    },
    {
      accessorKey: "pendingDays",
      header: "Pending",
    },
    {
      accessorKey: "availableBalance",
      header: "Available",
      cell: ({ row }) => (
        <div className="space-y-1">
          <div className="font-medium">{row.original.availableBalance}</div>
          {row.original.isOneOffEntitlement && <Badge variant="outline">One-off entitlement</Badge>}
        </div>
      ),
    },
    {
      accessorKey: "carryForwardExpiresAt",
      header: "Carry Forward Expiry",
      cell: ({ row }) =>
        row.original.carryForwardExpiresAt ? (
          new Date(row.original.carryForwardExpiresAt).toLocaleDateString()
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      id: "actions",
      header: "Adjust",
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const amount = window.prompt(
              `Enter adjustment days for ${formatText(row.original.leaveType)}`
            );
            if (!amount) {
              return;
            }

            const adjustmentDays = Number(amount);
            if (Number.isNaN(adjustmentDays)) {
              toast.error((t) => (
                <ToastContent
                  t={t}
                  title="Invalid amount"
                  message="Adjustment days must be a valid number."
                />
              ));
              return;
            }

            const reason = window.prompt(
              "Enter a reason. Include the word 'correction' if this should allow a negative balance."
            );
            if (!reason?.trim()) {
              return;
            }

            adjustmentMutation.mutate({
              leaveType: row.original.leaveType,
              adjustmentDays,
              reason,
            });
          }}
          disabled={adjustmentMutation.isPending || row.original.isOneOffEntitlement}
        >
          Adjust
        </Button>
      ),
    },
  ];

  return <DataTable columns={columns} data={balances} />;
}
