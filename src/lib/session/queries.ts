import { queryOptions } from "@tanstack/react-query";
import { getAuthContextFn } from "@/lib/session/session-service";

export const authContextQueryOptions = queryOptions({
	queryKey: ["auth", "context"] as const,
	queryFn: () => getAuthContextFn(),
	staleTime: 5 * 60 * 1000,
});
