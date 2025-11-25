import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import type { z } from "zod";
import {
	getActiveRoles,
	getPermissions,
	getRoleById,
	getRoles,
} from "@/features/users/services/roles.api";
import { getUsers, getUserWithRole } from "@/features/users/services/users.api";
import type { searchValidateSchema } from "@/lib/schema-rules";

export const usersQueries = {
	all: ["users"] as const,
	list: (filters: z.infer<typeof searchValidateSchema>) =>
		queryOptions({
			queryKey: [...usersQueries.all, "list", { filters }] as const,
			queryFn: () => getUsers({ data: { q: filters.q } }),
			placeholderData: keepPreviousData,
			staleTime: 60 * 1000,
		}),
	detail: (userId: string) =>
		queryOptions({
			queryKey: [...usersQueries.all, "detail", userId] as const,
			queryFn: () => getUserWithRole({ data: { userId } }),
		}),
};

export const rolesQueries = {
	all: ["roles"] as const,
	active: () =>
		queryOptions({
			queryKey: [...rolesQueries.all, "active"] as const,
			queryFn: () => getActiveRoles(),
		}),
	list: (query?: string) =>
		queryOptions({
			queryKey: [...rolesQueries.all, "list", query],
			queryFn: () => getRoles({ data: query }),
		}),
	detail: (roleId: string) =>
		queryOptions({
			queryKey: [...rolesQueries.all, "detail", roleId] as const,
			queryFn: () => getRoleById({ data: roleId }),
		}),
};

export const permissionsQueries = {
	all: ["permissions"] as const,
	list: () =>
		queryOptions({
			queryKey: [...permissionsQueries.all, "list"],
			queryFn: () => getPermissions(),
		}),
};
