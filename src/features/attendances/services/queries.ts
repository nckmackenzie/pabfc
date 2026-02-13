import { queryOptions } from "@tanstack/react-query";
import { getAttendances } from "@/features/attendances/services/attendance.api";
import type { AttendanceValidateSearch } from "./schema";

export const attendanceQueries = {
	all: ["attendances"] as const,
	list: (filters: AttendanceValidateSearch) =>
		queryOptions({
			queryKey: [...attendanceQueries.all, "list", filters],
			queryFn: () => getAttendances({ data: filters }),
			staleTime: 30_000, // 30 seconds
		}),
};
