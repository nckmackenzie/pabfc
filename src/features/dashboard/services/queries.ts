import { queryOptions } from "@tanstack/react-query";
import {
	dashboardStats,
	getAverageAttendanceByDay,
	getExpiringMemberships,
	getTodaysAttendances,
} from "@/features/dashboard/services/dashboard.api";

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
};
