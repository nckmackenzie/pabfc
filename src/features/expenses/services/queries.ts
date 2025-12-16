import { queryOptions } from "@tanstack/react-query";
import { getPayees } from "@/features/expenses/services/payees.api";

export const payeeQueries = {
	all: ["payees"] as const,
	list: () =>
		queryOptions({
			queryKey: [...payeeQueries.all, "list"],
			queryFn: () => getPayees(),
		}),
};
