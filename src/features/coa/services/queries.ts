import { queryOptions } from "@tanstack/react-query";
import type { z } from "zod";
import type { AccountType } from "@/drizzle/schema";
import {
	getAccount,
	getAccounts,
	getAccountsWithBalances,
	getChildrenAccountByParentName,
} from "@/features/coa/services/coa.api";
import type { searchValidateSchema } from "@/lib/schema-rules";
import { toTitleCase } from "@/lib/utils";

export const accountQueries = {
	all: ["accounts"] as const,
	list: (filters: z.infer<typeof searchValidateSchema>) =>
		queryOptions({
			queryKey: [...accountQueries.all, "list", filters],
			queryFn: () => getAccounts({ data: filters }),
		}),
	listWithBalances: (filters: z.infer<typeof searchValidateSchema>) => ({
		queryKey: [...accountQueries.all, "withBalances", filters],
		queryFn: () => getAccountsWithBalances({ data: filters }),
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
	activeAccounts: () =>
		queryOptions({
			queryKey: [...accountQueries.all, "active-accounts"],
			queryFn: async () => {
				const accounts = await getAccounts({ data: {} });
				return accounts
					.filter((account) => account.isActive)
					.map(({ id, name }) => ({
						value: id.toString(),
						label: toTitleCase(name),
					}));
			},
		}),
	activeChildAccountsByAccountType: (accountType: AccountType) =>
		queryOptions({
			queryKey: [...accountQueries.all, "active-accounts", accountType],
			queryFn: async () => {
				const accounts = await getAccounts({ data: {} });
				return accounts
					.filter(
						(account) =>
							account.parentId &&
							account.isActive &&
							account.type === accountType,
					)
					.map(({ id, name }) => ({
						value: id.toString(),
						label: toTitleCase(name),
					}));
			},
		}),
	childrenAccountsByParentName: (parentName: string) =>
		queryOptions({
			queryKey: [...accountQueries.all, "children-accounts", parentName],
			queryFn: () => getChildrenAccountByParentName({ data: parentName }),
		}),
};
