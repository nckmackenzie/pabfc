import { queryOptions } from "@tanstack/react-query";
import type { z } from "zod";
import {
	getBankPostings,
	getBankReconcilliation,
	getBanks,
} from "@/features/bankings/services/bankings.api";
import type { bankReconciliationFormSchema } from "@/features/bankings/services/schema";
import type { searchValidateSchema } from "@/lib/schema-rules";

export const bankQueries = {
	all: ["banks"],
	list: () =>
		queryOptions({
			queryKey: [...bankQueries.all, "list"],
			queryFn: () => getBanks(),
		}),
};

export const bankPostingQueries = {
	all: ["bankings"],
	list: (filters: z.infer<typeof searchValidateSchema>) =>
		queryOptions({
			queryKey: [...bankPostingQueries.all, "list", filters],
			queryFn: () => getBankPostings({ data: filters }),
		}),
	recon: (filters: z.infer<typeof bankReconciliationFormSchema>) =>
		queryOptions({
			queryKey: [...bankPostingQueries.all, "bank-reconcilliation", filters],
			queryFn: () =>
				getBankReconcilliation({
					data: filters,
				}),
		}),
};
