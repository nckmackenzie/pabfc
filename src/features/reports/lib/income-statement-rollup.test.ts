import { describe, expect, it } from "vitest";
import { computeSubtreeBalance } from "@/features/coa/services/helpers";

/**
 * The income statement lists only top-level (`parent_id IS NULL`) revenue/expense
 * accounts, each showing the recursively rolled-up total of its subtree. These
 * tests model that rule against the production rollup helper `computeSubtreeBalance`.
 *
 * Parent nodes carry a leaf `balance` of "0" (they never have direct postings);
 * leaves carry their net balance with the sign already applied per normal balance.
 */
type Node = { id: number; parentId: number | null; balance: string };

describe("income statement — top-level rollup semantics", () => {
	it("includes a top-level POSTING account with no children (Fix 2 gap)", () => {
		// 4999 Direct Sales: top-level, posting, no children, KES 7,777 revenue.
		// Under the old `is_posting = false` filter this vanished from the report.
		const accounts: Node[] = [{ id: 4999, parentId: null, balance: "7777" }];
		expect(computeSubtreeBalance(accounts, 4999)).toBe("7777");
	});

	it("rolls up a top-level revenue account's multi-level descendants", () => {
		const accounts: Node[] = [
			{ id: 4000, parentId: null, balance: "0" }, // Service Revenue (parent)
			{ id: 4001, parentId: 4000, balance: "1000" }, // Gym Membership (leaf)
			{ id: 4002, parentId: 4000, balance: "500" }, // Beverages (parent)
			{ id: 4003, parentId: 4002, balance: "250" }, // nested sub-leaf
		];
		expect(computeSubtreeBalance(accounts, 4000)).toBe("1750");
	});

	it("net income = rolled revenue − rolled expenses across top-level P&L accounts", () => {
		const accounts: Node[] = [
			{ id: 4000, parentId: null, balance: "0" },
			{ id: 4001, parentId: 4000, balance: "13660" },
			{ id: 5000, parentId: null, balance: "0" },
			{ id: 5001, parentId: 5000, balance: "12400" },
			{ id: 5002, parentId: 5000, balance: "22000" },
		];
		const revenue = Number(computeSubtreeBalance(accounts, 4000));
		const expenses = Number(computeSubtreeBalance(accounts, 5000));
		expect(revenue - expenses).toBe(13660 - 34400);
	});

	/**
	 * Invariant guaranteeing the income statement's net income equals the balance
	 * sheet's Current Year Earnings: summing each top-level subtree's rolled total
	 * equals summing every leaf posting directly (which is how CYE is computed).
	 */
	it("summing top-level rolled subtrees equals summing every leaf posting", () => {
		const accounts: Node[] = [
			{ id: 4000, parentId: null, balance: "0" },
			{ id: 4001, parentId: 4000, balance: "13660" },
			{ id: 4999, parentId: null, balance: "7777" }, // top-level posting leaf
			{ id: 5000, parentId: null, balance: "0" },
			{ id: 5001, parentId: 5000, balance: "12400" },
			{ id: 5002, parentId: 5000, balance: "22000" },
			{ id: 5090, parentId: null, balance: "0" },
			{ id: 5100, parentId: 5090, balance: "60953.52" },
		];

		const topLevelIds = accounts.filter((a) => a.parentId === null).map((a) => a.id);
		const rolledSum = topLevelIds.reduce(
			(sum, id) => sum + Number(computeSubtreeBalance(accounts, id)),
			0
		);
		const leafSum = accounts
			.filter((a) => !accounts.some((x) => x.parentId === a.id))
			.reduce((sum, a) => sum + Number(a.balance), 0);

		expect(rolledSum).toBe(leafSum);
	});
});
