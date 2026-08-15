import { describe, expect, it } from "vitest";
import type { AccountType } from "@/drizzle/schema";
import {
	filterActivePostingAccountsByType,
	findInvalidPostingAccountIdsByType,
} from "./account-option-filter";

type AccountOptionFilterInput = Parameters<typeof filterActivePostingAccountsByType>[0][number];

function account(
	overrides: Partial<AccountOptionFilterInput> & {
		id: number;
		type?: AccountType;
	}
): AccountOptionFilterInput {
	return {
		id: overrides.id,
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
