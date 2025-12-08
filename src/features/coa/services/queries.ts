import { queryOptions } from "@tanstack/react-query";
import { toTitleCase } from "@/lib/utils";
import { getAccounts } from "./coa.api";

export const accountQueries = {
	all: ["accounts"] as const,
	list: () =>
		queryOptions({
			queryKey: [...accountQueries.all, "list"],
			queryFn: () => getAccounts(),
		}),
	parentAccounts: () =>
		queryOptions({
			queryKey: [...accountQueries.all, "parent-accounts"],
			queryFn: async () => {
				const accounts = await getAccounts();
				return accounts
					.filter((account) => !account.parentId && account.isActive)
					.map((acc) => ({
						value: acc.id,
						label: toTitleCase(acc.name),
						type: acc.type,
					}));
			},
		}),
};
