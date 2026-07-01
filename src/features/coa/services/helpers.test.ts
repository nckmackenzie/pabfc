import { describe, expect, it } from "vitest";
import {
	buildTreeWithRollup,
	calcNormalBalance,
	computeSubtreeBalance,
	isAccountTypeMismatch,
} from "./helpers";

type Row = Parameters<typeof buildTreeWithRollup>[0][number];

function account(overrides: Partial<Row> & { id: number }): Row {
	return {
		id: overrides.id,
		code: overrides.code ?? null,
		name: overrides.name ?? `Account ${overrides.id}`,
		type: overrides.type ?? "asset",
		normalBalance: overrides.normalBalance ?? "debit",
		parentId: overrides.parentId ?? null,
		isPosting: overrides.isPosting ?? true,
		isActive: overrides.isActive ?? true,
		description: overrides.description ?? null,
		createdAt: overrides.createdAt ?? new Date(),
		updatedAt: overrides.updatedAt ?? new Date(),
		balance: overrides.balance ?? "0",
		rolledBalance: overrides.rolledBalance ?? "0",
	} as Row;
}

describe("calcNormalBalance — sign convention", () => {
	it("debit-normal accounts: balance = debits - credits", () => {
		expect(calcNormalBalance("debit", "1000", "300")).toBe("700");
	});

	it("credit-normal accounts: balance = credits - debits", () => {
		expect(calcNormalBalance("credit", "300", "1000")).toBe("700");
	});

	it("returns a negative balance when the account is contra to its normal side", () => {
		expect(calcNormalBalance("debit", "100", "400")).toBe("-300");
	});
});

describe("buildTreeWithRollup — recursive rollup", () => {
	it("single-level: a lone leaf rolls up to its own balance", () => {
		const [root] = buildTreeWithRollup([account({ id: 1, balance: "500", rolledBalance: "500" })]);
		expect(root.rolledBalance).toBe("500");
	});

	it("two-level: parent equals the sum of its direct children", () => {
		const [root] = buildTreeWithRollup([
			account({ id: 1, balance: "0" }),
			account({ id: 2, parentId: 1, balance: "300" }),
			account({ id: 3, parentId: 1, balance: "200" }),
		]);
		expect(root.rolledBalance).toBe("500");
	});

	it("three-level: parent equals the sum of all descendants at any depth", () => {
		const [root] = buildTreeWithRollup([
			account({ id: 1, balance: "10" }),
			account({ id: 2, parentId: 1, balance: "20" }),
			account({ id: 3, parentId: 2, balance: "30" }),
			account({ id: 4, parentId: 3, balance: "40" }),
		]);
		// 10 + 20 + 30 + 40
		expect(root.rolledBalance).toBe("100");
	});
});

describe("computeSubtreeBalance — rollup from an arbitrary node", () => {
	const accounts = [
		account({ id: 1, balance: "10" }),
		account({ id: 2, parentId: 1, balance: "20" }),
		account({ id: 3, parentId: 2, balance: "30" }),
		account({ id: 4, parentId: 1, balance: "5" }),
	];

	it("rolls up the whole tree from the root", () => {
		expect(computeSubtreeBalance(accounts, 1)).toBe("65");
	});

	it("rolls up only the subtree from a mid-level node", () => {
		expect(computeSubtreeBalance(accounts, 2)).toBe("50");
	});

	it("returns the leaf's own balance for a leaf node", () => {
		expect(computeSubtreeBalance(accounts, 3)).toBe("30");
	});

	it("returns 0 for an unknown node", () => {
		expect(computeSubtreeBalance(accounts, 999)).toBe("0");
	});
});

describe("isAccountTypeMismatch", () => {
	it("is false when child and parent share a type", () => {
		expect(isAccountTypeMismatch("asset", "asset")).toBe(false);
	});

	it("is true when child and parent types differ", () => {
		expect(isAccountTypeMismatch("asset", "liability")).toBe(true);
	});
});
