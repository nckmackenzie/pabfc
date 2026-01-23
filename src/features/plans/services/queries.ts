import { queryOptions } from "@tanstack/react-query";
import type { z } from "zod";
import {
	getPlan,
	getPlanMembers,
	getPlans,
	getPlanWithSummary,
} from "@/features/plans/services/plans.api";
import type { searchValidateSchema } from "@/lib/schema-rules";
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
};
