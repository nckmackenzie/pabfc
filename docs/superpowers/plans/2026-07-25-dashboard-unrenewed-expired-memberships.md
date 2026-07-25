# Dashboard Unrenewed Expired Memberships Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the dashboard expired-membership count and detail list exclude members who have a later active or pending membership.

**Architecture:** Move the shared dashboard expiration predicate into a focused query helper and add a correlated `NOT EXISTS` renewal condition there. Both existing server endpoints will consume that helper, while a query-compilation unit test verifies the database-level rule without requiring a live database.

**Tech Stack:** TypeScript, Drizzle ORM, PostgreSQL SQL generation, Vitest, date-fns.

## Global Constraints

- Keep the existing inclusive rolling 30-day expiration window.
- Treat only later `active` and `pending` memberships as valid renewals.
- A later membership in any other status does not exclude the expired membership.
- Preserve the existing deleted-member exclusion, permissions, selected detail fields, and ordering.
- Do not change the database schema or generated route files.

---

### Task 1: Add the shared unrenewed-expiration query predicate

**Files:**

- Create: `src/features/dashboard/lib/expired-memberships.ts`
- Create: `src/features/dashboard/lib/expired-memberships.test.ts`
- Modify: `src/features/dashboard/services/dashboard.api.ts:1-125`

**Interfaces:**

- Consumes: `memberMemberships` from `@/drizzle/schema` and `getExpiredMembershipStatDates(today?: Date)` from `@/features/dashboard/lib/helpers`.
- Produces: `getExpiredMembershipConditions(today?: Date): readonly SQL[]`, used by both dashboard expired-membership queries.

- [ ] **Step 1: Write the failing query-compilation test**

Create `src/features/dashboard/lib/expired-memberships.test.ts`. Build a minimal Drizzle select using the new helper and compile it with `toSQL()`:

```ts
import { and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { describe, expect, it } from "vitest";
import { memberMemberships } from "@/drizzle/schema";
import { getExpiredMembershipConditions } from "./expired-memberships";

describe("getExpiredMembershipConditions", () => {
	it("excludes only later active or pending memberships", () => {
		const query = drizzle
			.mock({ casing: "snake_case" })
			.select()
			.from(memberMemberships)
			.where(and(...getExpiredMembershipConditions(new Date("2026-07-25T09:30:00.000Z"))))
			.toSQL();

		expect(query.sql).toContain("not exists");
		expect(query.sql).toContain("mm_newer.start_date >");
		expect(query.sql).toContain("mm_newer.status in");
		expect(query.params).toEqual(
			expect.arrayContaining(["2026-06-25", "2026-07-25", "expired", "active", "pending"])
		);
		expect(query.params).not.toEqual(expect.arrayContaining(["cancelled", "terminated"]));
	});
});
```

If Drizzle emits quoted identifiers or a different whitespace layout, normalize whitespace in the assertion while preserving checks for the later-start correlation and the exact status parameters.

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
pnpm test src/features/dashboard/lib/expired-memberships.test.ts
```

Expected: FAIL because `./expired-memberships` and `getExpiredMembershipConditions` do not exist.

- [ ] **Step 3: Implement the minimal shared predicate**

Create `src/features/dashboard/lib/expired-memberships.ts`:

```ts
import { eq, gte, lte, sql } from "drizzle-orm";
import { memberMemberships } from "@/drizzle/schema";
import { getExpiredMembershipStatDates } from "@/features/dashboard/lib/helpers";
import { dateFormat } from "@/lib/helpers";

export function getExpiredMembershipConditions(today = new Date()) {
	const { periodStart, periodEnd } = getExpiredMembershipStatDates(today);

	return [
		gte(memberMemberships.endDate, dateFormat(periodStart)),
		lte(memberMemberships.endDate, dateFormat(periodEnd)),
		eq(memberMemberships.status, "expired"),
		sql`NOT EXISTS (
			SELECT 1
			FROM member_memberships mm_newer
			WHERE mm_newer.member_id = ${memberMemberships.memberId}
			AND mm_newer.start_date > ${memberMemberships.startDate}
			AND mm_newer.status IN (${"active"}, ${"pending"})
		)`,
	] as const;
}
```

The interpolated statuses remain bound query parameters. The correlated subquery deliberately compares `start_date`, matching the repository's existing definition of a later renewal in `src/features/receipts/lib/eligibility.ts`.

In `src/features/dashboard/services/dashboard.api.ts`:

- import `getExpiredMembershipConditions` from the new helper;
- remove the local function of the same name;
- remove imports used only by that local function (`gte`, `lte`, and `getExpiredMembershipStatDates`) if they are no longer used elsewhere;
- retain both existing calls to `...getExpiredMembershipConditions()` unchanged.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run:

```bash
pnpm test src/features/dashboard/lib/expired-memberships.test.ts src/features/dashboard/lib/helpers.test.ts
```

Expected: both test files PASS. Confirm the generated SQL contains a correlated later-start check and only `active`/`pending` renewal statuses.

- [ ] **Step 5: Run static verification**

Run:

```bash
pnpm typecheck
pnpm exec prettier --check src/features/dashboard/lib/expired-memberships.ts src/features/dashboard/lib/expired-memberships.test.ts src/features/dashboard/services/dashboard.api.ts
git diff --check
```

Expected: all commands exit successfully. If repository-wide type errors unrelated to these files exist, record them verbatim and run the narrowest available TypeScript verification for the touched files.

- [ ] **Step 6: Commit the implementation**

```bash
git add src/features/dashboard/lib/expired-memberships.ts src/features/dashboard/lib/expired-memberships.test.ts src/features/dashboard/services/dashboard.api.ts
git commit -m "exclude renewed members from expired dashboard stats"
```

---

### Task 2: Review the completed dashboard fix

**Files:**

- Review: `src/features/dashboard/lib/expired-memberships.ts`
- Review: `src/features/dashboard/lib/expired-memberships.test.ts`
- Review: `src/features/dashboard/services/dashboard.api.ts`

**Interfaces:**

- Consumes: the completed Task 1 diff and verification output.
- Produces: a review finding list or confirmation that the implementation matches the approved specification.

- [ ] **Step 1: Inspect the final diff**

Run:

```bash
git show --stat --oneline HEAD
git show --format=fuller --find-renames HEAD -- src/features/dashboard
```

Verify the change:

- affects both stat and detail queries through one shared predicate;
- correlates renewal rows by the same `member_id`;
- requires a strictly later `start_date`;
- recognizes only `active` and `pending` as renewal statuses;
- keeps the rolling window and `expired` candidate status;
- does not alter permissions, output shape, or ordering.

- [ ] **Step 2: Re-run final verification**

Run:

```bash
pnpm test src/features/dashboard/lib/expired-memberships.test.ts src/features/dashboard/lib/helpers.test.ts
pnpm typecheck
pnpm exec prettier --check src/features/dashboard/lib/expired-memberships.ts src/features/dashboard/lib/expired-memberships.test.ts src/features/dashboard/services/dashboard.api.ts
git diff --check
```

Expected: all checks PASS and the worktree contains no unintended changes.
