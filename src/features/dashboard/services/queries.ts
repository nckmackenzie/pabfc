import { queryOptions } from "@tanstack/react-query";
import {
	type AccessControlDashboardFilters,
	getAccessControlDashboard,
} from "@/features/dashboard/services/access-control.api";
import {
	dashboardStats,
	getActiveMemberships,
	getAverageAttendanceByDay,
	getExpiredMemberships,
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
	activeMemberships: () =>
		queryOptions({
			queryKey: [...dashboardQueries.all, "active-memberships"],
			queryFn: () => getActiveMemberships(),
		}),
	expiringMemberships: () =>
		queryOptions({
			queryKey: [...dashboardQueries.all, "expiring-memberships"],
			queryFn: () => getExpiringMemberships(),
		}),
	expiredMemberships: () =>
		queryOptions({
			queryKey: [...dashboardQueries.all, "expired-memberships"],
			queryFn: () => getExpiredMemberships(),
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
