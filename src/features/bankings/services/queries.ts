import { queryOptions } from "@tanstack/react-query";
import { getBanks } from "@/features/bankings/services/bankings.api";

export const bankQueries = {
	all: ["banks"],
	list: () =>
		queryOptions({
			queryKey: [...bankQueries.all, "list"],
			queryFn: () => getBanks(),
		}),
};
