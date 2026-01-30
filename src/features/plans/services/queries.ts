import { queryOptions } from "@tanstack/react-query";
import type { z } from "zod";
import {
	getPlan,
	getPlanMembers,
	getPlanPaymentsByDuration,
	getPlanRevenueStats,
	getPlanRevenueTrend,
	getPlans,
	getPlanWithSummary,
} from "@/features/plans/services/plans.api";
import type {
	dateRangeWithSearchSchema,
	reportDateRangeSchema,
	searchValidateSchema,
} from "@/lib/schema-rules";
import { toTitleCase } from "@/lib/utils";

export const planQueries = {
	all: ["plans"] as const,
	list: (filters?: z.infer<typeof searchValidateSchema>) =>
		queryOptions({
			queryKey: [...planQueries.all, "list", filters],
			queryFn: () => getPlans({ data: { q: filters?.q } }),
		}),
	detail: (id: string) =>
		queryOptions({
			queryKey: [...planQueries.all, "detail", id],
			queryFn: () => getPlan({ data: id }),
		}),
	active: () =>
		queryOptions({
			queryKey: [...planQueries.all, "active"],
			queryFn: async () => {
				const plans = await getPlans({ data: { q: undefined } });
				return plans
					.filter((plan) => plan.active)
					.map((plan) => ({
						value: plan.id,
						label: toTitleCase(plan.name),
					}));
			},
		}),
	planWithSummary: (planId: string) =>
		queryOptions({
			queryKey: [...planQueries.all, "plan-with-summary", planId],
			queryFn: () => getPlanWithSummary({ data: planId }),
		}),
	planWithMembers: (
		planId: string,
		filters: z.infer<typeof searchValidateSchema>,
	) =>
		queryOptions({
			queryKey: [...planQueries.all, "plan-with-members", planId, filters],
			queryFn: () => getPlanMembers({ data: { planId, filters } }),
		}),
	planRevenueStats: (
		planId: string,
		filters: z.infer<typeof reportDateRangeSchema>,
	) =>
		queryOptions({
			queryKey: [...planQueries.all, "plan-revenue-stats", planId, filters],
			queryFn: () =>
				getPlanRevenueStats({ data: { planId, dateRange: filters } }),
		}),
	planRevenuePayments: (
		planId: string,
		filters: z.infer<typeof dateRangeWithSearchSchema>,
	) =>
		queryOptions({
			queryKey: [...planQueries.all, "plan-revenue-payments", planId, filters],
			queryFn: () => getPlanPaymentsByDuration({ data: { planId, filters } }),
		}),
	planRevenueTrend: (
		planId: string,
		filters: z.infer<typeof reportDateRangeSchema>,
	) =>
		queryOptions({
			queryKey: [...planQueries.all, "plan-revenue-trend", planId, filters],
			queryFn: () =>
				getPlanRevenueTrend({ data: { planId, dateRange: filters } }),
		}),
};
