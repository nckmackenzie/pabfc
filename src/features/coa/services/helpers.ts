/** biome-ignore-all lint/suspicious/noExplicitAny: <> */

import Big from "big.js";
import type { ledgerAccounts } from "@/drizzle/schema";

export function calcNormalBalance(
	normal: "debit" | "credit",
	debits: string,
	credits: string,
) {
	const d = new Big(debits ?? "0");
	const c = new Big(credits ?? "0");
	return (normal === "debit" ? d.minus(c) : c.minus(d)).toString();
}

export function buildTreeWithRollup(
	accounts: (typeof ledgerAccounts.$inferSelect & {
		balance: string;
		rolledBalance: string;
	})[],
) {
	const map = new Map<number, any>();
	const roots: any[] = [];

	for (const a of accounts) map.set(a.id, { ...a, children: [] });

	for (const a of accounts) {
		const node = map.get(a.id);
		if (a.parentId && map.has(a.parentId))
			map.get(a.parentId)?.children.push(node);
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
