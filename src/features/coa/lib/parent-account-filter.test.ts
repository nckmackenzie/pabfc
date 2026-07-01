import { describe, expect, it } from "vitest";
import {
	collectDescendantIds,
	filterPotentialParents,
	type ParentCandidate,
} from "./parent-account-filter";

function acc(overrides: Partial<ParentCandidate> & { id: number }): ParentCandidate {
	return {
		id: overrides.id,
		code: overrides.code ?? null,
		name: overrides.name ?? `Account ${overrides.id}`,
		type: overrides.type ?? "asset",
		parentId: overrides.parentId ?? null,
		isActive: overrides.isActive ?? true,
	};
}

describe("collectDescendantIds", () => {
	const accounts = [
		acc({ id: 1 }),
		acc({ id: 2, parentId: 1 }),
		acc({ id: 3, parentId: 2 }),
		acc({ id: 4, parentId: 1 }),
		acc({ id: 5 }),
	];

	it("collects descendants at any depth, excluding the root", () => {
		expect([...collectDescendantIds(accounts, 1)].sort()).toEqual([2, 3, 4]);
	});

	it("returns an empty set for a leaf", () => {
		expect(collectDescendantIds(accounts, 3).size).toBe(0);
	});
});

describe("filterPotentialParents", () => {
	const accounts = [
		acc({ id: 1, name: "Assets" }),
		acc({ id: 2, name: "Cash", parentId: 1 }),
		acc({ id: 3, name: "Petty Cash", parentId: 2 }),
		acc({ id: 4, name: "Inactive", isActive: false }),
	];

	it("excludes accounts that already have journal lines posted", () => {
		const result = filterPotentialParents({
			accounts,
			accountIdsWithJournalLines: new Set([2]),
		});
		expect(result.map((a) => a.id)).not.toContain(2);
		expect(result.map((a) => a.id)).toContain(1);
	});

	it("excludes inactive accounts", () => {
		const result = filterPotentialParents({
			accounts,
			accountIdsWithJournalLines: new Set(),
		});
		expect(result.map((a) => a.id)).not.toContain(4);
	});

	it("excludes the account being edited and all its descendants", () => {
		const result = filterPotentialParents({
			accounts,
			accountIdsWithJournalLines: new Set(),
			currentAccountId: 1,
		});
		// 1 (self), 2 and 3 (descendants) all excluded
		expect(result.map((a) => a.id).sort()).toEqual([]);
	});

	it("keeps ancestors selectable when editing a nested account", () => {
		const result = filterPotentialParents({
			accounts,
			accountIdsWithJournalLines: new Set(),
			currentAccountId: 3,
		});
		// ancestors 1 and 2 remain valid parents; self (3) excluded
		expect(result.map((a) => a.id).sort()).toEqual([1, 2]);
	});
});
