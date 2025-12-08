import { queryOptions } from "@tanstack/react-query";
import type { z } from "zod";
import type { searchValidateSchema } from "@/lib/schema-rules";
import { toTitleCase } from "@/lib/utils";
import { getAccount, getAccounts } from "./coa.api";

export const accountQueries = {
	all: ["accounts"] as const,
	list: (filters: z.infer<typeof searchValidateSchema>) =>
		queryOptions({
			queryKey: [...accountQueries.all, "list", filters],
			queryFn: () => getAccounts({ data: filters }),
		}),
	parentAccounts: () =>
		queryOptions({
			queryKey: [...accountQueries.all, "parent-accounts"],
			queryFn: async () => {
				const accounts = await getAccounts({ data: {} });
				return accounts
					.filter((account) => !account.parentId && account.isActive)
					.map((acc) => ({
						value: acc.id,
						label: toTitleCase(acc.name),
						type: acc.type,
					}));
			},
		}),
	detail: (accountId: number) =>
		queryOptions({
			queryKey: [...accountQueries.all, "detail", accountId],
			queryFn: () => getAccount({ data: accountId }),
		}),
};
