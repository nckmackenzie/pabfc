/**
 * Posting-status rules for the account hierarchy.
 *
 * Core rule: only leaf accounts (no children) may have journal lines posted
 * against them. The moment an account is chosen as a parent it becomes an
 * aggregator and must be non-posting; it only becomes a posting leaf again once
 * it has no children left.
 */

/** A leaf account (no children) is posting; a parent account is not. */
export function childIsPosting(hasChildren: boolean): boolean {
	return !hasChildren;
}

/** Selecting an account as a parent always makes it non-posting. */
export function parentIsPostingOnAttach(): boolean {
	return false;
}

/**
 * After a child is detached from its old parent, that parent becomes a posting
 * leaf again only when it has no remaining children.
 */
export function shouldRestoreParentPosting(remainingChildren: number): boolean {
	return remainingChildren === 0;
}
