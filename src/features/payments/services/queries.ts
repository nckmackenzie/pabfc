import { queryOptions } from "@tanstack/react-query";
import { getPayments } from "./payments.queries.api";

export const paymentsQueries = {
	all: ["payments"] as const,
	list: () =>
		queryOptions({
			queryKey: [...paymentsQueries.all, "list"],
			queryFn: () => getPayments(),
			refetchInterval: 60 * 5 * 1000,
		}),
};
