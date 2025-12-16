import { queryOptions } from "@tanstack/react-query";
import { getExpenseNo } from "@/features/expenses/services/expenses.api";
import { getPayees } from "@/features/expenses/services/payees.api";

export const payeeQueries = {
	all: ["payees"] as const,
	list: () =>
		queryOptions({
			queryKey: [...payeeQueries.all, "list"],
			queryFn: () => getPayees(),
		}),
};

export const expenseQueries = {
	expenseNo: () =>
		queryOptions({
			queryKey: ["expenseNo"],
			queryFn: () => getExpenseNo(),
		}),
};
