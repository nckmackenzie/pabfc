import type { AccountType } from "@/drizzle/schema";

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
