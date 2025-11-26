import { queryOptions } from "@tanstack/react-query";
import { toTitleCase } from "@/lib/utils";
import { getPlans } from "./plans.api";

export const planQueries = {
	all: ["plans"] as const,
	list: () =>
		queryOptions({
			queryKey: [...planQueries.all, "list"],
			queryFn: () => getPlans(),
		}),
	active: () =>
		queryOptions({
			queryKey: [...planQueries.all, "active"],
			queryFn: async () => {
				const plans = await getPlans();
				return plans
					.filter((plan) => plan.active)
					.map((plan) => ({
						value: plan.id,
						label: toTitleCase(plan.name),
					}));
			},
		}),
};
