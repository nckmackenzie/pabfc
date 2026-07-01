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

/**
 * Both the update/detach path and the delete path call
 * `restoreParentPostingStatusIfNoChildren`, which decides via
 * `shouldRestoreParentPosting(remainingChildren)`.
 */
describe("account deletion restores parent posting status", () => {
	it("restores the parent to posting when its last child is deleted", () => {
		// After deleting the only child, the parent has 0 remaining children.
		expect(shouldRestoreParentPosting(0)).toBe(true);
	});

	it("leaves the parent non-posting when other children remain", () => {
		expect(shouldRestoreParentPosting(2)).toBe(false);
	});
});
