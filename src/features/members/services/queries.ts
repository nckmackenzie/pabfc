import { queryOptions } from "@tanstack/react-query";
import {
	getMember,
	getMembers,
} from "@/features/members/services/members.queries.api";
import type { MemberValidateSearch } from "@/features/members/services/schemas";
export const memberQueries = {
	all: ["members"],
	list: (filters: MemberValidateSearch) =>
		queryOptions({
			queryKey: [...memberQueries.all, "list", filters],
			queryFn: () => getMembers({ data: filters }),
		}),
	detail: (memberId: string) =>
		queryOptions({
			queryKey: [...memberQueries.all, "detail", memberId],
			queryFn: () => getMember({ data: memberId }),
		}),
};
