import { queryOptions } from "@tanstack/react-query";
import {
	type AccessControlDashboardFilters,
	getAccessControlDashboard,
} from "@/features/dashboard/services/access-control.api";
import {
	dashboardStats,
	getAverageAttendanceByDay,
	getExpiringMemberships,
	getTodaysAttendances,
} from "@/features/dashboard/services/dashboard.api";
import { getFinanceStats } from "@/features/dashboard/services/finance.api";

export const dashboardQueries = {
	all: ["dashboard"] as const,
	stats: () =>
		queryOptions({
			queryKey: [...dashboardQueries.all, "stats"],
			queryFn: () => dashboardStats(),
		}),
	todaysAttendances: () =>
		queryOptions({
			queryKey: [...dashboardQueries.all, "todays-attendances"],
			queryFn: () => getTodaysAttendances(),
			refetchInterval: 60 * 1000,
		}),
	expiringMemberships: () =>
		queryOptions({
			queryKey: [...dashboardQueries.all, "expiring-memberships"],
			queryFn: () => getExpiringMemberships(),
		}),
	averageAttendanceByDay: () =>
		queryOptions({
			queryKey: [...dashboardQueries.all, "average-attendance-by-day"],
			queryFn: () => getAverageAttendanceByDay(),
		}),
	financeStats: () =>
		queryOptions({
			queryKey: [...dashboardQueries.all, "finance-stats"],
			queryFn: () => getFinanceStats(),
		}),
	accessControl: (filters: AccessControlDashboardFilters) =>
		queryOptions({
			queryKey: [...dashboardQueries.all, "access-control", filters],
			queryFn: () => getAccessControlDashboard({ data: filters }),
			refetchInterval: 30 * 1000,
		}),
};
