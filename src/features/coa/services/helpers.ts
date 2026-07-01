/** biome-ignore-all lint/suspicious/noExplicitAny: <> */

import Big from "big.js";
import type { ledgerAccounts } from "@/drizzle/schema";

export function calcNormalBalance(normal: "debit" | "credit", debits: string, credits: string) {
	const d = new Big(debits ?? "0");
	const c = new Big(credits ?? "0");
	return (normal === "debit" ? d.minus(c) : c.minus(d)).toString();
}

export function buildTreeWithRollup(
	accounts: (typeof ledgerAccounts.$inferSelect & {
		balance: string;
		rolledBalance: string;
	})[]
) {
	const map = new Map<number, any>();
	const roots: any[] = [];

	for (const a of accounts) map.set(a.id, { ...a, children: [] });

	for (const a of accounts) {
		const node = map.get(a.id);
		if (a.parentId && map.has(a.parentId)) map.get(a.parentId)?.children.push(node);
		else roots.push(node);
	}

	const dfs = (node: any): Big => {
		let sum = new Big(node.balance ?? "0");
		for (const child of node.children) sum = sum.plus(dfs(child));
		node.rolledBalance = sum.toString();
		return sum;
	};

	for (const r of roots) dfs(r);
	return roots;
}

type BalanceNode = {
	id: number;
	parentId: number | null;
	balance: string;
};

/**
 * Recursively sums the leaf `balance` of `rootAccountId` plus every descendant at
 * any depth. Signs are expected to be applied per-leaf already (see
 * {@link calcNormalBalance}); this only rolls up. Callable from any node, which is
 * the foundation for progressive drill-down (Step 2B/2C follow-up).
 */
export function computeSubtreeBalance(accounts: BalanceNode[], rootAccountId: number): string {
	const childrenByParent = new Map<number, BalanceNode[]>();
	const byId = new Map<number, BalanceNode>();
	for (const account of accounts) {
		byId.set(account.id, account);
		if (account.parentId !== null) {
			const bucket = childrenByParent.get(account.parentId) ?? [];
			bucket.push(account);
			childrenByParent.set(account.parentId, bucket);
		}
	}

	const dfs = (id: number): Big => {
		const node = byId.get(id);
		let sum = new Big(node?.balance ?? "0");
		for (const child of childrenByParent.get(id) ?? []) sum = sum.plus(dfs(child.id));
		return sum;
	};

	if (!byId.has(rootAccountId)) return "0";
	return dfs(rootAccountId).toString();
}

/**
 * A child account must share its parent's account type (asset/liability/etc).
 * Returns true when the pairing is invalid and must be rejected.
 */
export function isAccountTypeMismatch(childType: string, parentType: string): boolean {
	return childType !== parentType;
}
