import { describe, expect, it } from "vitest";
import {
	childIsPosting,
	parentIsPostingOnAttach,
	shouldRestoreParentPosting,
} from "./posting-rules";

describe("posting rules", () => {
	it("a leaf account (no children) is posting", () => {
		expect(childIsPosting(false)).toBe(true);
	});

	it("an account with children is non-posting", () => {
		expect(childIsPosting(true)).toBe(false);
	});

	it("selecting an account as a parent always makes it non-posting", () => {
		expect(parentIsPostingOnAttach()).toBe(false);
	});

	it("restores posting on the old parent only when its last child is removed", () => {
		expect(shouldRestoreParentPosting(0)).toBe(true);
		expect(shouldRestoreParentPosting(1)).toBe(false);
		expect(shouldRestoreParentPosting(3)).toBe(false);
	});
});
