import type { AccountType } from "@/drizzle/schema";

export type ParentCandidate = {
	id: number;
	code: string | null;
	name: string;
	type: AccountType;
	parentId: number | null;
	isActive: boolean;
};

/**
 * Collects the full descendant set of `rootId` at any depth (excludes the root
 * itself). Used to prevent an account from selecting one of its own descendants
 * as a parent, which would create a circular hierarchy.
 */
export function collectDescendantIds(
	accounts: Array<Pick<ParentCandidate, "id" | "parentId">>,
	rootId: number
): Set<number> {
	const childrenByParent = new Map<number, number[]>();
	for (const account of accounts) {
		if (account.parentId !== null) {
			const bucket = childrenByParent.get(account.parentId) ?? [];
			bucket.push(account.id);
			childrenByParent.set(account.parentId, bucket);
		}
	}

	const descendants = new Set<number>();
	const stack = [...(childrenByParent.get(rootId) ?? [])];
	while (stack.length > 0) {
		// biome-ignore lint/style/noNonNullAssertion: guarded by length check
		const id = stack.pop()!;
		if (descendants.has(id)) continue;
		descendants.add(id);
		for (const child of childrenByParent.get(id) ?? []) stack.push(child);
	}

	return descendants;
}

/**
 * Returns the accounts eligible to be selected as a parent. An account qualifies
 * when it is active, has no direct journal postings (making it a parent would
 * retroactively turn a posted account non-posting — an integrity violation), is
 * not the account being edited, and is not one of that account's descendants.
 */
export function filterPotentialParents(params: {
	accounts: ParentCandidate[];
	accountIdsWithJournalLines: Set<number>;
	currentAccountId?: number;
}): Array<Pick<ParentCandidate, "id" | "code" | "name" | "type">> {
	const { accounts, accountIdsWithJournalLines, currentAccountId } = params;

	const descendantIds =
		currentAccountId !== undefined
			? collectDescendantIds(accounts, currentAccountId)
			: new Set<number>();

	return accounts
		.filter(
			(account) =>
				account.isActive &&
				!accountIdsWithJournalLines.has(account.id) &&
				account.id !== currentAccountId &&
				!descendantIds.has(account.id)
		)
		.map(({ id, code, name, type }) => ({ id, code, name, type }));
}
