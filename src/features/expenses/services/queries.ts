import { queryOptions } from "@tanstack/react-query";
import {
	getExpense,
	getExpenseJournal,
	getExpenseNo,
	getExpenses,
} from "@/features/expenses/services/expenses.api";
import { getPayees } from "@/features/expenses/services/payees.api";
import type { ExpenseValidateSearch } from "@/features/expenses/services/schemas";

export const payeeQueries = {
	all: ["payees"] as const,
	list: () =>
		queryOptions({
			queryKey: [...payeeQueries.all, "list"],
			queryFn: () => getPayees(),
		}),
};

export const expenseQueries = {
	all: ["expenses"] as const,
	expenseNo: () =>
		queryOptions({
			queryKey: ["expenseNo"],
			queryFn: () => getExpenseNo(),
		}),
	list: (filters: ExpenseValidateSearch) =>
		queryOptions({
			queryKey: [...expenseQueries.all, "list", filters],
			queryFn: () => getExpenses({ data: filters }),
		}),
	detail: (expenseId: string) =>
		queryOptions({
			queryKey: [...expenseQueries.all, "detail", expenseId],
			queryFn: () => getExpense({ data: expenseId }),
		}),
	journal: (expenseId: string) =>
		queryOptions({
			queryKey: [...expenseQueries.all, "journal", expenseId],
			queryFn: () => getExpenseJournal({ data: expenseId }),
		}),
};
