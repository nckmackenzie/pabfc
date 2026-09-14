import { describe, expect, it } from "vitest";
import type { AccountType } from "@/drizzle/schema";
import {
	filterActivePostingAccountsByType,
	findInvalidPostingAccountIdsByType,
	groupActivePostingAccountOptionsByParent,
} from "./account-option-filter";

type AccountOptionFilterInput = Parameters<typeof filterActivePostingAccountsByType>[0][number];
type AccountFixture = AccountOptionFilterInput & { code: string | null };

function account(
	overrides: Partial<AccountFixture> & {
		id: number;
		type?: AccountType;
	}
): AccountFixture {
	return {
		id: overrides.id,
		code: overrides.code ?? null,
		name: overrides.name ?? `Account ${overrides.id}`,
		type: overrides.type ?? "asset",
		isActive: overrides.isActive ?? true,
		isPosting: overrides.isPosting ?? true,
		parentId: overrides.parentId ?? null,
	};
}

describe("filterActivePostingAccountsByType", () => {
	it("keeps active root posting accounts for eligible types", () => {
		const result = filterActivePostingAccountsByType(
			[
				account({ id: 1, type: "expense", parentId: null, isPosting: true }),
				account({ id: 2, type: "asset", parentId: 1, isPosting: true }),
			],
			["expense", "asset"]
		);

		expect(result.map((item) => item.id)).toEqual([1, 2]);
	});

	it("excludes non-posting grouping accounts even when nested under another parent", () => {
		const result = filterActivePostingAccountsByType(
			[
				account({ id: 1, type: "expense", parentId: null, isPosting: true }),
				account({ id: 2, type: "expense", parentId: 1, isPosting: false }),
				account({ id: 3, type: "asset", parentId: 2, isPosting: true }),
			],
			["expense", "asset"]
		);

		expect(result.map((item) => item.id)).toEqual([1, 3]);
	});

	it("excludes inactive and non-matching account types", () => {
		const result = filterActivePostingAccountsByType(
			[
				account({ id: 1, type: "expense", isActive: false }),
				account({ id: 2, type: "revenue", isPosting: true }),
				account({ id: 3, type: "asset", isPosting: true }),
			],
			["expense", "asset"]
		);

		expect(result.map((item) => item.id)).toEqual([3]);
	});
});

describe("findInvalidPostingAccountIdsByType", () => {
	it("flags requested accounts that are inactive, non-posting, missing, or the wrong type", () => {
		const result = findInvalidPostingAccountIdsByType(
			[
				account({ id: 1, type: "expense", isPosting: true }),
				account({ id: 2, type: "expense", isPosting: false }),
				account({ id: 3, type: "asset", isActive: false }),
				account({ id: 4, type: "revenue", isPosting: true }),
			],
			[1, 2, 3, 4, 5],
			["expense", "asset"]
		);

		expect(result).toEqual([2, 3, 4, 5]);
	});
});

describe("groupActivePostingAccountOptionsByParent", () => {
	it("lists only active posting accounts grouped under their parent heading", () => {
		const result = groupActivePostingAccountOptionsByParent([
			account({ id: 1, code: "1000", name: "current assets", isPosting: false }),
			account({ id: 2, code: "1010", name: "cash at bank", parentId: 1 }),
			account({ id: 3, code: "1005", name: "petty cash", parentId: 1 }),
			account({ id: 4, code: "1020", name: "old till", parentId: 1, isActive: false }),
			account({ id: 5, code: "5000", name: "expenses", type: "expense", isPosting: false }),
			account({ id: 6, code: "5010", name: "rent", type: "expense", parentId: 5 }),
		]);

		expect(result).toEqual([
			{ value: "3", label: "1005 - Petty Cash", group: "1000 - Current Assets" },
			{ value: "2", label: "1010 - Cash At Bank", group: "1000 - Current Assets" },
			{ value: "6", label: "5010 - Rent", group: "5000 - Expenses" },
		]);
	});

	it("puts root posting accounts in a trailing top-level group", () => {
		const result = groupActivePostingAccountOptionsByParent([
			account({ id: 1, code: "9000", name: "suspense" }),
			account({ id: 2, code: "1000", name: "assets", isPosting: false }),
			account({ id: 3, name: "bank", parentId: 2 }),
		]);

		expect(result).toEqual([
			{ value: "3", label: "Bank", group: "1000 - Assets" },
			{ value: "1", label: "9000 - Suspense", group: "Top-level accounts" },
		]);
	});
});
