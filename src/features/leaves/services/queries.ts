import type {
  LeaveBalanceViewParams,
  LeaveRequestListFilters,
} from "@/features/leaves/utils/schemas";
import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import {
  getEmployeesForLeaveOptionsFn,
  getLeaveBalancesViewFn,
  getLeaveRequestsFn,
} from "./leave.api";

export const leaveQueries = {
  all: ["leaves"] as const,
  list: (filters: LeaveRequestListFilters) =>
    queryOptions({
      queryKey: [...leaveQueries.all, "list", filters] as const,
      queryFn: () => getLeaveRequestsFn({ data: filters }),
      placeholderData: keepPreviousData,
      staleTime: 60 * 1000,
    }),
  employees: () =>
    queryOptions({
      queryKey: [...leaveQueries.all, "employees"] as const,
      queryFn: () => getEmployeesForLeaveOptionsFn(),
      staleTime: 5 * 60 * 1000,
    }),
  balances: ({ employeeId, leaveYear }: LeaveBalanceViewParams) =>
    queryOptions({
      queryKey: [...leaveQueries.all, "balances", employeeId ?? "", leaveYear ?? ""] as const,
      queryFn: () =>
        getLeaveBalancesViewFn({
          data: {
            employeeId: employeeId ?? "",
            leaveYear,
          },
        }),
      placeholderData: keepPreviousData,
      staleTime: 60 * 1000,
    }),
};
