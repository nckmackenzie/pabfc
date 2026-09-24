import { queryOptions } from "@tanstack/react-query";
import {
	getActiveMembers,
	getMember,
	getMemberAttendanceHistory,
	getMemberPaymentHistory,
	getMemberProfileData,
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
	overview: (memberId: string) =>
		queryOptions({
			queryKey: [...memberQueries.all, "overview", memberId],
			queryFn: () => getMemberProfileData({ data: memberId }),
		}),
	paymentHistory: (memberId: string) =>
		queryOptions({
			queryKey: [...memberQueries.all, "payment-history", memberId],
			queryFn: () => getMemberPaymentHistory({ data: memberId }),
		}),
	attendanceHistory: (memberId: string) =>
		queryOptions({
			queryKey: [...memberQueries.all, "attendance-history", memberId],
			queryFn: () => getMemberAttendanceHistory({ data: memberId }),
		}),
	activeMembers: () =>
		queryOptions({
			queryKey: [...memberQueries.all, "activeMembers"],
			// queryFn: () => getMembers({ data: { status: "active" } }),
			queryFn: () => getActiveMembers(),
		}),
	allMembersValueWithLabel: () =>
		queryOptions({
			queryKey: [...memberQueries.all, "allMembersValueWithLabel"],
			queryFn: async () => {
				const members = await getMembers({ data: {} });
				return members.map(({ id, fullName }) => ({
					value: id,
					label: fullName,
				}));
			},
		}),
};
