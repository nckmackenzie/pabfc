import type { AccountType } from "@/drizzle/schema";
import { toTitleCase } from "@/lib/utils";
import type { Option } from "@/types/index.types";

type AccountOptionFilterInput = {
	id: number;
	name: string;
	type: AccountType;
	isActive: boolean;
	isPosting: boolean;
	parentId: number | null;
};

export function filterActivePostingAccountsByType(
	accounts: AccountOptionFilterInput[],
	accountTypes: AccountType[]
) {
	return accounts.filter(
		(account) =>
			account.isActive && account.isPosting && accountTypes.includes(account.type)
	);
}

export function findInvalidPostingAccountIdsByType(
	accounts: AccountOptionFilterInput[],
	accountIds: number[],
	accountTypes: AccountType[]
) {
	const eligibleIds = new Set(
		filterActivePostingAccountsByType(accounts, accountTypes).map((account) => account.id)
	);

	return [...new Set(accountIds)].filter((accountId) => !eligibleIds.has(accountId));
}

type GroupedAccountOptionInput = Omit<AccountOptionFilterInput, "type"> & {
	code: string | null;
};

export type GroupedAccountOption = Option & { group: string };

const TOP_LEVEL_ACCOUNT_GROUP = "Top-level accounts";

function accountLabel(account: { code: string | null; name: string }) {
	const name = toTitleCase(account.name);
	return account.code ? `${account.code} - ${name}` : name;
}

function compareByCodeThenName(
	a: { code: string | null; name: string },
	b: { code: string | null; name: string }
) {
	if (a.code && b.code && a.code !== b.code) return a.code.localeCompare(b.code);
	if (a.code && !b.code) return -1;
	if (!a.code && b.code) return 1;
	return a.name.localeCompare(b.name);
}

/**
 * Builds selectable options for active posting accounts, each tagged with its
 * parent account as a group heading so pickers can mirror the chart hierarchy.
 * Groups follow the parent's code order; root posting accounts come last.
 */
export function groupActivePostingAccountOptionsByParent(
	accounts: GroupedAccountOptionInput[]
): GroupedAccountOption[] {
	const accountsById = new Map(accounts.map((account) => [account.id, account]));
	const postingAccounts = accounts.filter((account) => account.isActive && account.isPosting);

	return postingAccounts
		.map((account) => ({
			account,
			parent: account.parentId ? accountsById.get(account.parentId) : undefined,
		}))
		.sort((a, b) => {
			if (a.parent && !b.parent) return -1;
			if (!a.parent && b.parent) return 1;
			if (a.parent && b.parent && a.parent.id !== b.parent.id) {
				return compareByCodeThenName(a.parent, b.parent);
			}
			return compareByCodeThenName(a.account, b.account);
		})
		.map(({ account, parent }) => ({
			value: account.id.toString(),
			label: accountLabel(account),
			group: parent ? accountLabel(parent) : TOP_LEVEL_ACCOUNT_GROUP,
		}));
}
