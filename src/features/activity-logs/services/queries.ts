import { queryOptions } from "@tanstack/react-query";
import { getActivityLogs } from "./logs.api";
import type { ActivityLogSearchParams } from "./schemas";

export const activityLogsQueries = {
	all: ["all"] as const,
	list: (filters: ActivityLogSearchParams) =>
		queryOptions({
			queryKey: [...activityLogsQueries.all, "list", filters],
			queryFn: () => getActivityLogs({ data: { ...filters } }),
		}),
};
