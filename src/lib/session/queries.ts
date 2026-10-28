import { queryOptions } from "@tanstack/react-query";
import { getAuthContextFn } from "@/lib/session/session-service";

export const authContextQueryOptions = queryOptions({
	queryKey: ["auth", "context"] as const,
	queryFn: () => getAuthContextFn(),
	// Route authorization must be checked again on every navigation. Permissions
	// or sessions can be revoked from a different browser.
	staleTime: 0,
});
