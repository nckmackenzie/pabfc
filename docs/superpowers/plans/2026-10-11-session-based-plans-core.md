# Session-Based Plans — Core (Part 1 of 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add session-based membership plans — a plan with a fixed `sessionCount` consumed by the member's first punch of each Nairobi-local day — with a reconciliation engine, its triggers, manual adjustments, and guards on Void/Upgrade/Credit Note. Part 2 (separate plan) covers UI and switching the attendance screens to one-row-per-day.

**Architecture:** A new `vw_daily_attendance` Postgres view collapses `attendance_logs` to one row per member per Nairobi-local day. A new `membership_session_usage` table records which days were consumed, manually added, or waived. A pure, DB-free planner function decides what to insert/truncate/restore from (membership, usage rows, daily-attendance rows); a thin DB wrapper applies those decisions inside a per-member-locked transaction. The wrapper is invoked from three places: after the BioTime upload endpoint commits new punches, once nightly from the existing cron, and inline from the new manual add/waive server functions.

**Tech Stack:** TypeScript, Drizzle ORM (PostgreSQL), TanStack Start `createServerFn`, Zod v4, Vitest.

## Global Constraints

- A visit = the first punch of the Nairobi-local day (`Africa/Nairobi`). Multiple punches in a day are one session. Raw `attendance_logs` rows are never modified.
- A membership is a "session membership" iff `memberMemberships.sessionsTotal IS NOT NULL`, snapshotted at creation as `plan.sessionCount × numberOfPeriods`. Later plan edits never change existing memberships.
- Validity ends at whichever comes first: sessions used up, or the date window (`startDate..endDate`). Unused sessions lapse at the end date.
- When the last session is used, the membership stays valid for the rest of that Nairobi day and is expired the following Nairobi day.
- Session-based plans are single-member only (`memberCount === 1`) for v1.
- Sessions used is derived by counting non-voided `membership_session_usage` rows — there is no stored counter.
- Manual add/waive requires a reason (≥10 chars, matching `voidPaymentSchema`'s convention), is permission-gated (`attendance:adjust-sessions`), and leaves an audit trail.
- Not supported in v1, guarded with a clear message: Void once any usage row exists; Upgrade for session memberships (original or target plan); Credit Note for session memberships.
- Out of scope: resolving unmapped punches (no such flow exists anywhere in this codebase today); freeze (not implemented anywhere); the attendance report; the dead `check_out_time`/`duration` metrics.
- Do not change `vw_attendance_details`, `vw_member_overview`, `dateFormat`, or the generic `expireMembershipsAndDisableAccess`/`activateDueMemberships` logic. Report on their date-boundary behavior (Task 16) instead of changing them.
- **Resolved conflict 1 (access on reactivation):** the upgrade flow's reactivation path (`payment.mutations.api.ts:883-898`) does not call any access-enable function today — there is nothing to "mirror." Confirmed with the user: `reconcileOneMembership` calls `enableMemberAccess` explicitly on reactivation, using a new `EnableAccessReason` value `"session_usage_restored"`. The pre-existing gap in the upgrade flow itself is out of scope and is not touched.
- **Resolved conflict 2 (activity-log actor):** `activityLogs.userId` is `NOT NULL` and this codebase has no "system user" convention — none of the existing automated jobs (`expireMembershipsAndDisableAccess`, `deactivateInactiveMembers`, `activateDueMemberships`) write to `activityLogs` at all. Confirmed with the user: `reconcileOneMembership`/`reconcileSessionUsage` take an optional `actorUserId`. Truncate/restore are logged only when it's present (i.e. when called from the manual add/waive functions). The automated triggers (upload endpoint, nightly cron) do not pass one, so they skip the `activityLogs` insert for truncate/restore — the returned counts plus `console.warn` are the audit trail for those paths. The manual add/waive functions always log their own action separately, regardless.
- Migrations are generated only (`pnpm db:generate`), never run/applied, per `AGENTS.md`.

---

### Task 1: Nairobi-local date helper

**Files:**
- Create: `src/lib/nairobi-time.ts`
- Test: `src/lib/nairobi-time.test.ts`

**Interfaces:**
- Produces: `NAIROBI_TZ: string`, `toNairobiDateString(instant: Date): string` (returns `"YYYY-MM-DD"`), `nairobiToday(now?: Date): string`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/nairobi-time.test.ts
import { describe, expect, it } from "vitest";
import { nairobiToday, toNairobiDateString } from "./nairobi-time";

describe("toNairobiDateString", () => {
	it("keeps the same Nairobi day just before the UTC+3 boundary", () => {
		expect(toNairobiDateString(new Date("2026-10-10T20:59:59Z"))).toBe("2026-10-10");
	});

	it("rolls over to the next Nairobi day exactly at the UTC+3 boundary", () => {
		expect(toNairobiDateString(new Date("2026-10-10T21:00:00Z"))).toBe("2026-10-11");
	});

	it("handles a year boundary correctly", () => {
		expect(toNairobiDateString(new Date("2026-12-31T20:59:59Z"))).toBe("2026-12-31");
		expect(toNairobiDateString(new Date("2026-12-31T21:00:00Z"))).toBe("2027-01-01");
	});
});

describe("nairobiToday", () => {
	it("computes today's Nairobi date from a given instant", () => {
		expect(nairobiToday(new Date("2026-06-15T12:00:00Z"))).toBe("2026-06-15");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/nairobi-time.test.ts`
Expected: FAIL — `Cannot find module './nairobi-time'`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/nairobi-time.ts

export const NAIROBI_TZ = "Africa/Nairobi";

// en-CA renders Intl.DateTimeFormat's numeric/2-digit y/m/d as "YYYY-MM-DD" —
// using the IANA zone directly means this is correct regardless of the
// server/runtime's own TZ setting, unlike dateFormat/new Date() elsewhere in
// this codebase.
const nairobiDateFormatter = new Intl.DateTimeFormat("en-CA", {
	timeZone: NAIROBI_TZ,
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
});

export function toNairobiDateString(instant: Date): string {
	return nairobiDateFormatter.format(instant);
}

export function nairobiToday(now: Date = new Date()): string {
	return toNairobiDateString(now);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/nairobi-time.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/nairobi-time.ts src/lib/nairobi-time.test.ts
git commit -m "feat: add Nairobi-local date helper for session-based plans"
```

---

### Task 2: Schema — `membership_session_usage` table and `member_memberships` columns

**Files:**
- Create: `src/drizzle/schemas/membership-session-usage.ts`
- Modify: `src/drizzle/schemas/member.ts` (add two columns to `memberMemberships`)
- Modify: `src/drizzle/schema.ts` (barrel export)
- Generate: a new numbered migration under `src/drizzle/migrations/`

**Interfaces:**
- Produces: `membershipSessionUsage` table (columns: `id, membershipId, memberId, usageDate, source, attendanceLogId, reason, createdByUserId, voidedAt, voidedByUserId, voidReason, createdAt, updatedAt`), `membershipSessionUsageRelations`. `memberMemberships.sessionsTotal: number | null`, `memberMemberships.originalEndDate: string | null`.

- [ ] **Step 1: Add the two columns to `memberMemberships`**

In `src/drizzle/schemas/member.ts`, inside the `memberMemberships` table definition, after `previousMembershipPlanId`:

```ts
		previousMembershipPlanId: varchar("previous_membership_plan_id", {
			length: 255,
		}),
		// Snapshotted at creation as plan.sessionCount × numberOfPeriods. Null means
		// "not a session membership" — never re-derived from the plan's current
		// isSessionBased/sessionCount, so later plan edits don't change this row.
		sessionsTotal: integer("sessions_total"),
		// Pre-truncation endDate, set the first time a session membership's endDate
		// is truncated on exhaustion. Null again once restored (e.g. after a waiver
		// brings used sessions back below sessionsTotal). See reconcileOneMembership.
		originalEndDate: date("original_end_date"),
		createdAt,
		updatedAt,
```

Both `integer` and `date` are already imported at the top of `member.ts`.

- [ ] **Step 2: Create the usage table**

```ts
// src/drizzle/schemas/membership-session-usage.ts
import { relations } from "drizzle-orm";
import {
	bigint,
	date,
	index,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	varchar,
} from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "@/drizzle/schema-helpers";
import { attendanceLogs } from "./attendance";
import { users } from "./auth";
import { memberMemberships, members } from "./member";

// One row per Nairobi-local day consumed against a session-based membership.
// A waived day is a voided row (voidedAt set), never deleted — reconciliation
// must see it to avoid re-creating it. See reconcileOneMembership.
export const membershipSessionUsage = pgTable(
	"membership_session_usage",
	{
		id,
		membershipId: varchar("membership_id")
			.notNull()
			.references(() => memberMemberships.id, { onDelete: "restrict" }),
		memberId: varchar("member_id")
			.notNull()
			.references(() => members.id, { onDelete: "restrict" }),
		usageDate: date("usage_date").notNull(),
		source: varchar("source", { length: 20 }).notNull(), // 'punch' | 'manual'
		// Nullable + onDelete set null: this table is the durable audit trail and
		// must survive attendance_logs cleanup (see Task 16's deleteOlderLogs finding).
		attendanceLogId: bigint("attendance_log_id", { mode: "bigint" }).references(
			() => attendanceLogs.id,
			{ onDelete: "set null" }
		),
		reason: text("reason"),
		createdByUserId: varchar("created_by_user_id").references(() => users.id),
		voidedAt: timestamp("voided_at", { withTimezone: true }),
		voidedByUserId: varchar("voided_by_user_id").references(() => users.id),
		voidReason: text("void_reason"),
		createdAt,
		updatedAt,
	},
	(table) => [
		// Includes voided rows deliberately — a waived day must never be re-created.
		uniqueIndex("uq_membership_session_usage_membership_date").on(
			table.membershipId,
			table.usageDate
		),
		index("idx_membership_session_usage_member_date").on(table.memberId, table.usageDate),
	]
);

export const membershipSessionUsageRelations = relations(membershipSessionUsage, ({ one }) => ({
	membership: one(memberMemberships, {
		fields: [membershipSessionUsage.membershipId],
		references: [memberMemberships.id],
	}),
	member: one(members, {
		fields: [membershipSessionUsage.memberId],
		references: [members.id],
	}),
	attendanceLog: one(attendanceLogs, {
		fields: [membershipSessionUsage.attendanceLogId],
		references: [attendanceLogs.id],
	}),
	createdByUser: one(users, {
		fields: [membershipSessionUsage.createdByUserId],
		references: [users.id],
		relationName: "membershipSessionUsageCreatedBy",
	}),
	voidedByUser: one(users, {
		fields: [membershipSessionUsage.voidedByUserId],
		references: [users.id],
		relationName: "membershipSessionUsageVoidedBy",
	}),
}));
```

- [ ] **Step 3: Add the barrel export**

In `src/drizzle/schema.ts`, add a new line after the `membership-upgrades` export (keep alphabetical-ish grouping):

```ts
export * from "@/drizzle/schemas/membership-session-usage";
```

- [ ] **Step 4: Generate the migration**

Run: `pnpm db:generate`
Expected: a new file `src/drizzle/migrations/0100_<auto-name>.sql` containing `CREATE TABLE "membership_session_usage" (...)`, its two indexes, and `ALTER TABLE "member_memberships" ADD COLUMN "sessions_total" integer, ADD COLUMN "original_end_date" date;` (exact wording depends on drizzle-kit's diff). Open the generated file and confirm both changes are present. **Do not run it.**

- [ ] **Step 5: Commit**

```bash
git add src/drizzle/schemas/membership-session-usage.ts src/drizzle/schemas/member.ts src/drizzle/schema.ts src/drizzle/migrations/
git commit -m "feat: add membership_session_usage table and member_memberships session columns"
```

---

### Task 3: Schema — `vw_daily_attendance` view

**Files:**
- Modify: `src/drizzle/schemas/attendance.ts` (add `pgView(...).existing()` declaration)
- Generate: a new custom migration under `src/drizzle/migrations/`

**Interfaces:**
- Produces: `dailyAttendance` (Drizzle view handle for `vw_daily_attendance`), columns `memberId, attendanceDate, firstCheckInTime, lastCheckInTime, punchCount, firstAttendanceLogId`.

- [ ] **Step 1: Add the view declaration**

In `src/drizzle/schemas/attendance.ts`, add `bigint` and `date` to the `drizzle-orm/pg-core` import list, and add this after `attendanceOverview`:

```ts
// One row per member per Nairobi-local day. A device/terminal filter would go
// in the WHERE clause below if this gym ever runs more than one BioTime
// reader that writes to attendance_logs — today the app models exactly one
// device (biotimeSettings.deviceSerialNumber), so none is applied.
export const dailyAttendance = pgView("vw_daily_attendance", {
	memberId: varchar("member_id").notNull(),
	attendanceDate: date("attendance_date").notNull(),
	firstCheckInTime: timestamp("first_check_in_time", { withTimezone: true }).notNull(),
	lastCheckInTime: timestamp("last_check_in_time", { withTimezone: true }).notNull(),
	punchCount: integer("punch_count").notNull(),
	firstAttendanceLogId: bigint("first_attendance_log_id", { mode: "bigint" }).notNull(),
}).existing();
```

- [ ] **Step 2: Generate the empty custom migration**

Run: `pnpm db:generate --custom --name=create_vw_daily_attendance_view`
Expected: a new empty file `src/drizzle/migrations/0101_create_vw_daily_attendance_view.sql` (matches how `0091_capture_and_extend_reporting_views.sql` was produced — hand-written SQL with no schema diff behind it, since the view is `.existing()`).

- [ ] **Step 3: Write the view SQL**

Edit the generated file to contain exactly:

```sql
CREATE VIEW vw_daily_attendance AS
SELECT
	al.member_id,
	(al.check_in_time AT TIME ZONE 'Africa/Nairobi')::date AS attendance_date,
	min(al.check_in_time) AS first_check_in_time,
	max(al.check_in_time) AS last_check_in_time,
	count(*)::int AS punch_count,
	(array_agg(al.id ORDER BY al.check_in_time ASC, al.id ASC))[1] AS first_attendance_log_id
FROM attendance_logs al
GROUP BY al.member_id, (al.check_in_time AT TIME ZONE 'Africa/Nairobi')::date;
```

No `DROP VIEW IF EXISTS` guard is needed here (unlike migration 0091) — `vw_daily_attendance` is a brand new name with no pre-existing materialized-view collision risk.

- [ ] **Step 4: Commit**

```bash
git add src/drizzle/schemas/attendance.ts src/drizzle/migrations/0101_create_vw_daily_attendance_view.sql
git commit -m "feat: add vw_daily_attendance view (one row per member per Nairobi day)"
```

---

### Task 4: Permission constant

**Files:**
- Modify: `src/lib/permissions/constants.ts`

**Interfaces:**
- Produces: permission string `"attendance:adjust-sessions"` added to the `PERMISSIONS` array.

- [ ] **Step 1: Add the permission**

In `src/lib/permissions/constants.ts`, add `"attendance:adjust-sessions"` immediately after `"attendance:view"`:

```ts
	"attendance:view",
	"attendance:adjust-sessions",
```

- [ ] **Step 2: Run typecheck to confirm no breakage**

Run: `pnpm typecheck`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/permissions/constants.ts
git commit -m "feat: add attendance:adjust-sessions permission"
```

Note for the final report: this permission ships unassigned to any role — role-to-permission assignment in this codebase is runtime-only via the Roles screen, with no seed-time wiring to extend (same situation as `receipts:top-up-late` before it).

---

### Task 5: `computeSessionsTotal` helper and plan single-member guard

**Files:**
- Modify: `src/features/receipts/lib/helpers.ts`
- Modify: `src/features/receipts/lib/helpers.test.ts`
- Modify: `src/features/plans/services/schemas.ts`

**Interfaces:**
- Produces: `computeSessionsTotal(plan: { isSessionBased: boolean; sessionCount: number }, numberOfPeriods: number): number | null`

- [ ] **Step 1: Write the failing tests**

Add to `src/features/receipts/lib/helpers.test.ts` (new `import` goes in the existing import block from `"./helpers"`; add `computeSessionsTotal` to it):

```ts
describe("computeSessionsTotal", () => {
	it("returns sessionCount × numberOfPeriods for a session-based plan", () => {
		expect(computeSessionsTotal({ isSessionBased: true, sessionCount: 10 }, 2)).toBe(20);
	});

	it("returns null for a non-session-based plan regardless of sessionCount", () => {
		expect(computeSessionsTotal({ isSessionBased: false, sessionCount: 10 }, 2)).toBeNull();
	});

	it("returns sessionCount unchanged for a single period", () => {
		expect(computeSessionsTotal({ isSessionBased: true, sessionCount: 12 }, 1)).toBe(12);
	});
});
```

Create `src/features/plans/services/schemas.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { planSchema } from "./schemas";

const basePlan = {
	name: "10 Session Pack",
	duration: 90,
	price: 5000,
	description: null,
	isSessionBased: true,
	sessionCount: 10,
	active: true,
	revenueAccountId: "1",
	lateUpgradeGraceDays: null,
};

describe("planSchema session-based member count guard", () => {
	it("rejects a session-based plan with memberCount other than 1", () => {
		const result = planSchema.safeParse({ ...basePlan, memberCount: 2 });
		expect(result.success).toBe(false);
	});

	it("accepts a session-based plan with memberCount 1", () => {
		const result = planSchema.safeParse({ ...basePlan, memberCount: 1 });
		expect(result.success).toBe(true);
	});

	it("does not restrict memberCount for a non-session-based plan", () => {
		const result = planSchema.safeParse({ ...basePlan, isSessionBased: false, memberCount: 4 });
		expect(result.success).toBe(true);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/features/receipts/lib/helpers.test.ts src/features/plans/services/schemas.test.ts`
Expected: FAIL — `computeSessionsTotal is not exported`, and the memberCount guard test fails because no such rule exists yet.

- [ ] **Step 3: Implement**

In `src/features/receipts/lib/helpers.ts`, add near `computeMembershipEndDate`:

```ts
// Snapshotted at membership creation, not re-derived from the plan later — see
// memberMemberships.sessionsTotal. Null means "not a session membership."
export function computeSessionsTotal(
	plan: { isSessionBased: boolean; sessionCount: number },
	numberOfPeriods: number
): number | null {
	return plan.isSessionBased ? plan.sessionCount * numberOfPeriods : null;
}
```

In `src/features/plans/services/schemas.ts`, inside the existing `superRefine`, add alongside the `sessionCount` check:

```ts
		if (data.isSessionBased && data.memberCount !== 1) {
			ctx.addIssue({
				code: "custom",
				path: ["memberCount"],
				message: "Session-based plans must cover exactly one member",
			});
		}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/features/receipts/lib/helpers.test.ts src/features/plans/services/schemas.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/receipts/lib/helpers.ts src/features/receipts/lib/helpers.test.ts src/features/plans/services/schemas.ts src/features/plans/services/schemas.test.ts
git commit -m "feat: add computeSessionsTotal helper and single-member guard for session plans"
```

---

### Task 6: Snapshot `sessionsTotal` at every membership creation site

**Files:**
- Modify: `src/features/receipts/services/membership-payment-finalizer.ts`
- Modify: `src/features/receipts/services/complimentary.mutations.api.ts`

**Interfaces:**
- Consumes: `computeSessionsTotal` from Task 5.

- [ ] **Step 1: `finalizeMembershipPayment`**

In `src/features/receipts/services/membership-payment-finalizer.ts`, add the import:

```ts
import {
	computeMembershipEndDate,
	computeSessionsTotal,
	parseCalendarDate,
	splitAmountEvenly,
} from "@/features/receipts/lib/helpers";
```

In the `tx.insert(memberMemberships).values({...})` call inside the `for (const [index, memberId] of coveredMemberIds.entries())` loop (currently ending with `priceCharged: priceChargedShares[index],`), add:

```ts
			await tx.insert(memberMemberships).values({
				memberId,
				membershipPlanId: payment.planId,
				startDate: dateFormat(startDate),
				endDate: dateFormat(endDate),
				autoRenew: false,
				status: membershipStatus,
				paymentId: payment.id,
				previousMembershipPlanId: mostRecentMembership?.membershipPlanId,
				priceCharged: priceChargedShares[index],
				sessionsTotal: computeSessionsTotal(plan, periods),
			});
```

(`plan` and `periods` are already in scope from earlier in the function.)

- [ ] **Step 2: Complimentary approval**

In `src/features/receipts/services/complimentary.mutations.api.ts`, import `computeSessionsTotal` from `@/features/receipts/lib/helpers` (add to the existing import from that module, or add a new import line). In the `tx.insert(memberMemberships).values({...})` call:

```ts
					await tx.insert(memberMemberships).values({
						memberId: request.memberId,
						membershipPlanId: request.planId,
						startDate: dateFormat(request.startDate),
						endDate: dateFormat(endDate),
						autoRenew: false,
						status: membershipStatus,
						paymentId: payment.id,
						previousMembershipPlanId: mostRecentMembership?.membershipPlanId,
						priceCharged: "0.00",
						sessionsTotal: computeSessionsTotal(plan, request.numberOfPeriods),
					});
```

- [ ] **Step 3: Run typecheck and existing tests**

Run: `pnpm typecheck && pnpm test`
Expected: no new errors; no existing test regressions (no existing test asserts the exact shape of either insert's `.values()` call).

- [ ] **Step 4: Commit**

```bash
git add src/features/receipts/services/membership-payment-finalizer.ts src/features/receipts/services/complimentary.mutations.api.ts
git commit -m "feat: snapshot sessionsTotal at membership creation"
```

---

### Task 7: Pure reconciliation planner

**Files:**
- Create: `src/features/session-usage/lib/reconciliation.ts`
- Test: `src/features/session-usage/lib/reconciliation.test.ts`

**Interfaces:**
- Produces: `planSessionReconciliation(input): ReconciliationAction[]`, types `SessionMembershipInput`, `UsageRowInput`, `DailyAttendanceInput`, `ReconciliationAction`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/features/session-usage/lib/reconciliation.test.ts
import { describe, expect, it } from "vitest";
import { planSessionReconciliation } from "./reconciliation";

const baseMembership = {
	id: "m1",
	memberId: "mem1",
	startDate: "2026-01-01",
	endDate: "2026-03-31",
	originalEndDate: null as string | null,
	status: "active" as const,
	sessionsTotal: 3,
};

describe("planSessionReconciliation", () => {
	it("consumes eligible days in ascending order, one insertUsage per day", () => {
		const actions = planSessionReconciliation({
			membership: baseMembership,
			usageRows: [],
			dailyAttendance: [
				{ attendanceDate: "2026-01-05", firstAttendanceLogId: 5n },
				{ attendanceDate: "2026-01-02", firstAttendanceLogId: 2n },
			],
			today: "2026-01-06",
		});
		expect(actions).toEqual([
			{ type: "insertUsage", usageDate: "2026-01-02", attendanceLogId: 2n },
			{ type: "insertUsage", usageDate: "2026-01-05", attendanceLogId: 5n },
		]);
	});

	it("marks punches beyond sessionsTotal as overConsumption instead of inserting", () => {
		const actions = planSessionReconciliation({
			membership: baseMembership,
			usageRows: [
				{ id: "u1", usageDate: "2026-01-01", voidedAt: null },
				{ id: "u2", usageDate: "2026-01-02", voidedAt: null },
				{ id: "u3", usageDate: "2026-01-03", voidedAt: null },
			],
			dailyAttendance: [{ attendanceDate: "2026-01-04", firstAttendanceLogId: 4n }],
			today: "2026-01-04",
		});
		expect(actions).toEqual([{ type: "overConsumption", usageDate: "2026-01-04" }]);
	});

	it("truncates the end date to the last usage date once sessions are exhausted", () => {
		const actions = planSessionReconciliation({
			membership: baseMembership,
			usageRows: [
				{ id: "u1", usageDate: "2026-01-01", voidedAt: null },
				{ id: "u2", usageDate: "2026-01-02", voidedAt: null },
			],
			dailyAttendance: [{ attendanceDate: "2026-01-10", firstAttendanceLogId: 10n }],
			today: "2026-01-10",
		});
		expect(actions).toEqual([
			{ type: "insertUsage", usageDate: "2026-01-10", attendanceLogId: 10n },
			{ type: "truncateEnd", originalEndDate: "2026-03-31", newEndDate: "2026-01-10" },
		]);
	});

	it("never re-counts a waived (voided) day", () => {
		const actions = planSessionReconciliation({
			membership: baseMembership,
			usageRows: [{ id: "u1", usageDate: "2026-01-02", voidedAt: new Date("2026-01-03") }],
			dailyAttendance: [{ attendanceDate: "2026-01-02", firstAttendanceLogId: 2n }],
			today: "2026-01-05",
		});
		expect(actions).toEqual([]);
	});

	it("restores the end date and flags reactivate when a waiver drops used below total on an expired membership", () => {
		const actions = planSessionReconciliation({
			membership: {
				...baseMembership,
				status: "expired",
				endDate: "2026-01-10",
				originalEndDate: "2026-03-31",
			},
			usageRows: [
				{ id: "u1", usageDate: "2026-01-01", voidedAt: null },
				{ id: "u2", usageDate: "2026-01-05", voidedAt: null },
				{ id: "u3", usageDate: "2026-01-10", voidedAt: new Date("2026-01-11") },
			],
			dailyAttendance: [],
			today: "2026-01-20",
		});
		expect(actions).toEqual([
			{ type: "restoreEnd", endDate: "2026-03-31", reactivate: true },
		]);
	});

	it("restores without reactivating when the membership is not expired", () => {
		const actions = planSessionReconciliation({
			membership: {
				...baseMembership,
				status: "active",
				endDate: "2026-01-10",
				originalEndDate: "2026-03-31",
			},
			usageRows: [
				{ id: "u1", usageDate: "2026-01-01", voidedAt: null },
				{ id: "u2", usageDate: "2026-01-05", voidedAt: new Date("2026-01-06") },
			],
			dailyAttendance: [],
			today: "2026-01-20",
		});
		expect(actions).toEqual([{ type: "restoreEnd", endDate: "2026-03-31", reactivate: false }]);
	});

	it("ignores daily-attendance days outside the membership window", () => {
		const actions = planSessionReconciliation({
			membership: baseMembership,
			usageRows: [],
			dailyAttendance: [
				{ attendanceDate: "2025-12-31", firstAttendanceLogId: 1n },
				{ attendanceDate: "2026-04-01", firstAttendanceLogId: 2n },
			],
			today: "2026-04-02",
		});
		expect(actions).toEqual([]);
	});

	it("is idempotent: feeding its own output back in produces no new actions", () => {
		const firstPassUsage = [
			{ id: "u1", usageDate: "2026-01-01", voidedAt: null },
			{ id: "u2", usageDate: "2026-01-02", voidedAt: null },
			{ id: "u3", usageDate: "2026-01-03", voidedAt: null },
		];
		const membershipAfterTruncation = {
			...baseMembership,
			endDate: "2026-01-03",
			originalEndDate: "2026-03-31",
		};
		const actions = planSessionReconciliation({
			membership: membershipAfterTruncation,
			usageRows: firstPassUsage,
			dailyAttendance: [],
			today: "2026-01-10",
		});
		expect(actions).toEqual([]);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/features/session-usage/lib/reconciliation.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

```ts
// src/features/session-usage/lib/reconciliation.ts

export type SessionMembershipInput = {
	id: string;
	memberId: string;
	startDate: string; // yyyy-MM-dd
	endDate: string; // yyyy-MM-dd
	originalEndDate: string | null; // yyyy-MM-dd, pre-truncation endDate
	status: "active" | "pending" | "expired";
	sessionsTotal: number;
};

export type UsageRowInput = {
	id: string;
	usageDate: string; // yyyy-MM-dd
	voidedAt: Date | null;
};

export type DailyAttendanceInput = {
	attendanceDate: string; // yyyy-MM-dd
	firstAttendanceLogId: bigint;
};

export type ReconciliationAction =
	| { type: "insertUsage"; usageDate: string; attendanceLogId: bigint }
	| { type: "truncateEnd"; originalEndDate: string; newEndDate: string }
	| { type: "restoreEnd"; endDate: string; reactivate: boolean }
	| { type: "overConsumption"; usageDate: string };

// Pure, DB-free: decides what reconcileOneMembership should write. Idempotent —
// feeding its own output back in (as fresh usageRows/membership state) always
// produces an empty action list.
export function planSessionReconciliation({
	membership,
	usageRows,
	dailyAttendance,
	today,
}: {
	membership: SessionMembershipInput;
	usageRows: UsageRowInput[];
	dailyAttendance: DailyAttendanceInput[];
	today: string;
}): ReconciliationAction[] {
	const actions: ReconciliationAction[] = [];
	const windowEnd = membership.originalEndDate ?? membership.endDate;
	const existingDates = new Set(usageRows.map((row) => row.usageDate));
	const nonVoided = usageRows.filter((row) => row.voidedAt === null);

	let used = nonVoided.length;
	let maxUsageDate = nonVoided.reduce<string | null>(
		(max, row) => (max === null || row.usageDate > max ? row.usageDate : max),
		null
	);

	const eligibleDays = dailyAttendance
		.filter(
			(day) =>
				day.attendanceDate >= membership.startDate &&
				day.attendanceDate <= windowEnd &&
				!existingDates.has(day.attendanceDate)
		)
		.sort((a, b) => (a.attendanceDate < b.attendanceDate ? -1 : 1));

	for (const day of eligibleDays) {
		if (used < membership.sessionsTotal) {
			actions.push({
				type: "insertUsage",
				usageDate: day.attendanceDate,
				attendanceLogId: day.firstAttendanceLogId,
			});
			used += 1;
			if (maxUsageDate === null || day.attendanceDate > maxUsageDate) {
				maxUsageDate = day.attendanceDate;
			}
		} else {
			actions.push({ type: "overConsumption", usageDate: day.attendanceDate });
		}
	}

	if (used >= membership.sessionsTotal && maxUsageDate !== null) {
		const targetEnd = maxUsageDate < windowEnd ? maxUsageDate : windowEnd;
		if (targetEnd !== membership.endDate) {
			actions.push({
				type: "truncateEnd",
				originalEndDate: membership.originalEndDate ?? membership.endDate,
				newEndDate: targetEnd,
			});
		}
	} else if (membership.originalEndDate !== null) {
		actions.push({
			type: "restoreEnd",
			endDate: membership.originalEndDate,
			reactivate: membership.status === "expired" && membership.originalEndDate >= today,
		});
	}

	return actions;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/features/session-usage/lib/reconciliation.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add src/features/session-usage/lib/reconciliation.ts src/features/session-usage/lib/reconciliation.test.ts
git commit -m "feat: add pure session-usage reconciliation planner"
```

---

### Task 8: `member-access.ts` — add the `session_usage_restored` reason

**Files:**
- Modify: `src/services/member-access.ts`

**Interfaces:**
- Produces: `EnableAccessReason` gains `"session_usage_restored"`.

- [ ] **Step 1: Extend the union**

In `src/services/member-access.ts`, change:

```ts
type EnableAccessReason = "membership_activated" | "manual_activation";
```

to:

```ts
type EnableAccessReason = "membership_activated" | "manual_activation" | "session_usage_restored";
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: no new errors (this is a non-breaking union widening; `enableMemberAccess`'s only caller today still passes `"membership_activated"`).

- [ ] **Step 3: Commit**

```bash
git add src/services/member-access.ts
git commit -m "feat: add session_usage_restored access-enable reason"
```

---

### Task 9: DB wrapper — `reconcileOneMembership` and `reconcileSessionUsage`

**Files:**
- Create: `src/features/session-usage/services/reconcile.ts`

**Interfaces:**
- Consumes: `planSessionReconciliation` (Task 7), `lockMemberMembershipCreation` from `@/features/receipts/services/payment.mutations.api`, `nairobiToday` from `@/lib/nairobi-time`, `enableMemberAccess` from `@/services/member-access`, `Transaction` type from `@/features/receipts/services/membership-payment-finalizer`.
- Produces:
  - `reconcileOneMembership(tx: Transaction, membershipId: string, opts?: { now?: Date; actorUserId?: string }): Promise<{ usageInserted: number; truncated: boolean; restored: boolean; overConsumption: string[] }>` — assumes the caller already holds the per-member advisory lock and is inside a transaction. No-ops (returns all zeros/false) if the membership isn't a session membership.
  - `reconcileSessionUsage(opts?: { memberIds?: string[]; now?: Date }): Promise<ReconcileSessionUsageResult>` — opens its own transaction + lock per membership. Never throws on a per-membership failure path other than genuine DB errors (those propagate — callers of this function are expected to catch, per Task 10/11).

This task has no DB to test against (no DB-backed tests in this codebase — see `AGENTS.md`/Task 16's convention note), so it is reviewed by reading, not by a Vitest run. Steps are structured as write → self-review against Task 7's planner contract → typecheck.

- [ ] **Step 1: Implement**

```ts
// src/features/session-usage/services/reconcile.ts
import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import {
	activityLogs,
	dailyAttendance as dailyAttendanceView,
	memberMemberships,
	membershipSessionUsage,
} from "@/drizzle/schema";
import type { Transaction } from "@/features/receipts/services/membership-payment-finalizer";
import { lockMemberMembershipCreation } from "@/features/receipts/services/payment.mutations.api";
import {
	type DailyAttendanceInput,
	planSessionReconciliation,
	type UsageRowInput,
} from "@/features/session-usage/lib/reconciliation";
import { nairobiToday } from "@/lib/nairobi-time";
import { enableMemberAccess } from "@/services/member-access";

export type ReconcileSessionUsageResult = {
	membershipsChecked: number;
	usageInserted: number;
	truncated: number;
	restored: number;
	overConsumption: Array<{ memberId: string; usageDate: string }>;
};

type ReconcileOneResult = {
	usageInserted: number;
	truncated: boolean;
	restored: boolean;
	overConsumption: string[];
};

// Re-runs the planner for one membership and applies its actions. The caller
// must already be inside a transaction holding the per-member advisory lock
// (lockMemberMembershipCreation) — this function does neither itself, so the
// manual add/waive server functions can call it right after their own write,
// in the same transaction, without nesting transactions or double-locking.
export async function reconcileOneMembership(
	tx: Transaction,
	membershipId: string,
	{ now = new Date(), actorUserId }: { now?: Date; actorUserId?: string } = {}
): Promise<ReconcileOneResult> {
	const empty: ReconcileOneResult = {
		usageInserted: 0,
		truncated: false,
		restored: false,
		overConsumption: [],
	};

	const membership = await tx.query.memberMemberships.findFirst({
		where: eq(memberMemberships.id, membershipId),
	});
	if (!membership || membership.sessionsTotal === null || !membership.endDate) {
		return empty;
	}
	if (membership.status !== "active" && membership.status !== "pending" && membership.status !== "expired") {
		return empty;
	}

	const today = nairobiToday(now);
	const windowEnd = membership.originalEndDate ?? membership.endDate;

	const usageRowsRaw = await tx
		.select({
			id: membershipSessionUsage.id,
			usageDate: membershipSessionUsage.usageDate,
			voidedAt: membershipSessionUsage.voidedAt,
		})
		.from(membershipSessionUsage)
		.where(eq(membershipSessionUsage.membershipId, membershipId));
	const usageRows: UsageRowInput[] = usageRowsRaw.map((row) => ({
		id: row.id,
		usageDate: row.usageDate,
		voidedAt: row.voidedAt,
	}));

	const dailyRowsRaw = await tx
		.select({
			attendanceDate: dailyAttendanceView.attendanceDate,
			firstAttendanceLogId: dailyAttendanceView.firstAttendanceLogId,
		})
		.from(dailyAttendanceView)
		.where(
			and(
				eq(dailyAttendanceView.memberId, membership.memberId),
				gte(dailyAttendanceView.attendanceDate, membership.startDate),
				lte(dailyAttendanceView.attendanceDate, windowEnd)
			)
		);
	const dailyAttendance: DailyAttendanceInput[] = dailyRowsRaw.map((row) => ({
		attendanceDate: row.attendanceDate,
		firstAttendanceLogId: row.firstAttendanceLogId,
	}));

	const actions = planSessionReconciliation({
		membership: {
			id: membership.id,
			memberId: membership.memberId,
			startDate: membership.startDate,
			endDate: membership.endDate,
			originalEndDate: membership.originalEndDate,
			status: membership.status,
			sessionsTotal: membership.sessionsTotal,
		},
		usageRows,
		dailyAttendance,
		today,
	});

	const outcome: ReconcileOneResult = { ...empty };

	for (const action of actions) {
		if (action.type === "insertUsage") {
			await tx
				.insert(membershipSessionUsage)
				.values({
					membershipId: membership.id,
					memberId: membership.memberId,
					usageDate: action.usageDate,
					source: "punch",
					attendanceLogId: action.attendanceLogId,
				})
				.onConflictDoNothing({
					target: [membershipSessionUsage.membershipId, membershipSessionUsage.usageDate],
				});
			outcome.usageInserted += 1;
		} else if (action.type === "truncateEnd") {
			await tx
				.update(memberMemberships)
				.set({ endDate: action.newEndDate, originalEndDate: action.originalEndDate })
				.where(eq(memberMemberships.id, membership.id));
			if (actorUserId) {
				await tx.insert(activityLogs).values({
					userId: actorUserId,
					action: "truncate session membership",
					description: `Membership ${membership.id} exhausted its sessions; end date truncated to ${action.newEndDate}.`,
				});
			}
			outcome.truncated = true;
		} else if (action.type === "restoreEnd") {
			await tx
				.update(memberMemberships)
				.set({
					endDate: action.endDate,
					originalEndDate: null,
					...(action.reactivate ? { status: "active" as const } : {}),
				})
				.where(eq(memberMemberships.id, membership.id));
			if (actorUserId) {
				await tx.insert(activityLogs).values({
					userId: actorUserId,
					action: "restore session membership",
					description: `Membership ${membership.id} end date restored to ${action.endDate}.`,
				});
			}
			if (action.reactivate) {
				await enableMemberAccess(tx, membership.memberId, "session_usage_restored");
			}
			outcome.restored = true;
		} else if (action.type === "overConsumption") {
			outcome.overConsumption.push(action.usageDate);
			console.warn(
				`Session membership ${membership.id} (member ${membership.memberId}) had a punch on ${action.usageDate} after its sessions were exhausted.`
			);
		}
	}

	return outcome;
}

// Full sweep (or a filtered one by memberIds): opens its own transaction + lock
// per membership, so it's safe to call concurrently and repeatedly. Never takes
// an actorUserId — this path has no human actor (see Global Constraints).
export async function reconcileSessionUsage({
	memberIds,
	now = new Date(),
}: { memberIds?: string[]; now?: Date } = {}): Promise<ReconcileSessionUsageResult> {
	const candidates = await db
		.select({ id: memberMemberships.id, memberId: memberMemberships.memberId })
		.from(memberMemberships)
		.where(
			and(
				sql`${memberMemberships.sessionsTotal} is not null`,
				inArray(memberMemberships.status, ["active", "pending", "expired"]),
				memberIds && memberIds.length > 0 ? inArray(memberMemberships.memberId, memberIds) : undefined
			)
		);

	const result: ReconcileSessionUsageResult = {
		membershipsChecked: candidates.length,
		usageInserted: 0,
		truncated: 0,
		restored: 0,
		overConsumption: [],
	};

	for (const candidate of candidates) {
		await db.transaction(async (tx) => {
			await lockMemberMembershipCreation(tx, candidate.memberId);
			const outcome = await reconcileOneMembership(tx, candidate.id, { now });
			result.usageInserted += outcome.usageInserted;
			if (outcome.truncated) result.truncated += 1;
			if (outcome.restored) result.restored += 1;
			result.overConsumption.push(
				...outcome.overConsumption.map((usageDate) => ({ memberId: candidate.memberId, usageDate }))
			);
		});
	}

	return result;
}
```

- [ ] **Step 2: Self-review against the planner contract**

Confirm by reading: every `ReconciliationAction` variant from Task 7 has a corresponding branch above; `windowEnd` is computed identically to the planner's internal `membership.originalEndDate ?? membership.endDate`; the `onConflictDoNothing` target matches the unique index from Task 2 exactly (`membershipId`, `usageDate`).

- [ ] **Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: no errors. If `dailyAttendanceView.attendanceDate`'s inferred type isn't a plain `string` (Drizzle's `date()` column type can map to `string` by default — confirm against how `memberMemberships.startDate`/`endDate` are typed elsewhere, since those are also `date()` columns compared as strings throughout this codebase, e.g. in `membershipRangeConflicts`), no cast should be needed; if TypeScript disagrees, align the comparison to how `helpers.ts`'s existing date-string comparisons are typed rather than adding an `as string` cast.

- [ ] **Step 4: Commit**

```bash
git add src/features/session-usage/services/reconcile.ts
git commit -m "feat: add reconcileOneMembership and reconcileSessionUsage DB wrapper"
```

---

### Task 10: Upload-endpoint trigger

**Files:**
- Modify: `src/routes/api/access-control/agent/attendance-sync/upload/index.ts`

**Interfaces:**
- Consumes: `reconcileSessionUsage` (Task 9).

- [ ] **Step 1: Thread inserted member IDs out of the transaction**

In `src/routes/api/access-control/agent/attendance-sync/upload/index.ts`, add the import:

```ts
import { reconcileSessionUsage } from "@/features/session-usage/services/reconcile";
```

Near the other `let` counters (`let insertedCount = 0; let employeeInsertedCount = 0; let unmappedInsertedCount = 0;`), add:

```ts
						let insertedMemberIds: string[] = [];
```

Change the mapped-rows insert block from:

```ts
						if (mappedRows.length > 0) {
							const inserted = await tx
								.insert(attendanceLogs)
								.values(mappedRows)
								.onConflictDoNothing({ target: attendanceLogs.biotimeId })
								.returning({ id: attendanceLogs.id });
							insertedCount = inserted.length;
						}
```

to:

```ts
						if (mappedRows.length > 0) {
							const inserted = await tx
								.insert(attendanceLogs)
								.values(mappedRows)
								.onConflictDoNothing({ target: attendanceLogs.biotimeId })
								.returning({ id: attendanceLogs.id, memberId: attendanceLogs.memberId });
							insertedCount = inserted.length;
							insertedMemberIds = [...new Set(inserted.map((row) => row.memberId))];
						}
```

Change the transaction's final `return { ... }` from:

```ts
						return {
							receivedCount: transactions.length,
							validCount: validTransactions.length,
							insertedCount,
							employeeInsertedCount,
							unmappedCount: unmappedInsertedCount,
							skippedDuplicateCount,
						};
```

to:

```ts
						return {
							receivedCount: transactions.length,
							validCount: validTransactions.length,
							insertedCount,
							employeeInsertedCount,
							unmappedCount: unmappedInsertedCount,
							skippedDuplicateCount,
							insertedMemberIds,
						};
```

- [ ] **Step 2: Add a one-line comment noting the unmapped-resolution gap**

Immediately above `const unmappedRows: ...` declaration, add:

```ts
						// No flow anywhere in this codebase resolves an unmapped row into a
						// member/attendance_logs match after the fact — these punches never
						// consume a session. See the session-based-plans discovery doc.
```

- [ ] **Step 3: Call `reconcileSessionUsage` after the transaction commits**

After `const result = await db.transaction(async (tx) => { ... });` and before the success `Response` is built, add:

```ts
					if (result.insertedMemberIds.length > 0) {
						try {
							await reconcileSessionUsage({ memberIds: result.insertedMemberIds });
						} catch (error) {
							console.error("reconcileSessionUsage failed after attendance upload", error);
						}
					}
```

This must never affect the response or throw past this point — a duplicate punch will simply never retry the reconcile (duplicates are dropped by `onConflictDoNothing` before this point is reached), which is why the nightly sweep (Task 11) exists as the safety net.

- [ ] **Step 4: Run typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/routes/api/access-control/agent/attendance-sync/upload/index.ts
git commit -m "feat: reconcile session usage after new attendance punches are uploaded"
```

---

### Task 11: Nightly cron step

**Files:**
- Modify: `src/routes/api/cron/daily/index.ts`

**Interfaces:**
- Consumes: `reconcileSessionUsage` (Task 9), `nairobiToday` (Task 1), `disableMemberAccessIfNoValidMembership` (existing).

- [ ] **Step 1: Add imports**

In `src/routes/api/cron/daily/index.ts`, change the existing drizzle-orm import line:

```ts
import { and, eq, isNull, lt, lte, notInArray, or, sql } from "drizzle-orm";
```

to add `inArray`:

```ts
import { and, eq, inArray, isNull, lt, lte, notInArray, or, sql } from "drizzle-orm";
```

And add two new import lines near the other feature imports:

```ts
import { reconcileSessionUsage } from "@/features/session-usage/services/reconcile";
import { nairobiToday } from "@/lib/nairobi-time";
```

- [ ] **Step 2: Add `expireExhaustedSessionMemberships`**

Add this new function near `expireMembershipsAndDisableAccess`:

```ts
// Session memberships end at whichever comes first: sessions exhausted
// (reconcileSessionUsage already truncated endDate for those) or the date
// window lapsing unused. Both cases are just "endDate < today" once
// reconcileSessionUsage has run — but unlike expireMembershipsAndDisableAccess,
// "today" here must be the Nairobi calendar date, not whatever the server's
// local/UTC date happens to be (see Task 16's finding). Runs before the
// generic expiry step so session memberships are correctly dated first; the
// generic step is then a no-op for rows this one already expired.
async function expireExhaustedSessionMemberships() {
	const today = nairobiToday();

	await db.transaction(async (tx) => {
		const toExpire = await tx
			.select({ id: memberMemberships.id, memberId: memberMemberships.memberId })
			.from(memberMemberships)
			.where(
				and(
					sql`${memberMemberships.sessionsTotal} is not null`,
					eq(memberMemberships.status, "active"),
					lt(memberMemberships.endDate, today)
				)
			);

		if (toExpire.length === 0) return;

		await tx
			.update(memberMemberships)
			.set({ status: "expired", updatedAt: new Date() })
			.where(inArray(memberMemberships.id, toExpire.map((row) => row.id)));

		const affectedMemberIds = [...new Set(toExpire.map((row) => row.memberId))];
		for (const memberId of affectedMemberIds) {
			await disableMemberAccessIfNoValidMembership(tx, memberId, "membership_expired");
		}
	});
}
```

- [ ] **Step 3: Wire it into `runDailyMaintenance`**

Change:

```ts
async function runDailyMaintenance() {
	// 1) delete older audit logs
	await deleteOlderLogs();

	// Invoice overdue state is no longer stamped onto bills.status here. It is
	// derived by vw_invoices from the payment lines on every read, so it stays
	// correct between runs instead of lagging up to a day behind.

	// 2) auto create financial year
	await autoCreateFinancialYear();

	// 3) update membership status rollovers (pending → active, active → expired)
	await expireMembershipsAndDisableAccess();

	// 4) deactivate inactive members
	await deactivateInactiveMembers();

	// 5) write off expired, unredeemed credit note balances
	await expireCreditNotes();
}
```

to:

```ts
async function runDailyMaintenance() {
	// 1) delete older audit logs
	await deleteOlderLogs();

	// Invoice overdue state is no longer stamped onto bills.status here. It is
	// derived by vw_invoices from the payment lines on every read, so it stays
	// correct between runs instead of lagging up to a day behind.

	// 2) auto create financial year
	await autoCreateFinancialYear();

	// 3) reconcile session-based memberships against yesterday/today's punches
	// (safety net for the upload-endpoint trigger), then expire the ones that
	// ran out of sessions or lapsed unused, using the Nairobi calendar day.
	await reconcileSessionUsage();
	await expireExhaustedSessionMemberships();

	// 4) update membership status rollovers (pending → active, active → expired)
	await expireMembershipsAndDisableAccess();

	// 5) deactivate inactive members
	await deactivateInactiveMembers();

	// 6) write off expired, unredeemed credit note balances
	await expireCreditNotes();
}
```

- [ ] **Step 4: Run typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/routes/api/cron/daily/index.ts
git commit -m "feat: reconcile and expire session-based memberships in the nightly cron"
```

---

### Task 12: Manual add/waive server functions

**Files:**
- Create: `src/features/session-usage/services/schemas.ts`
- Create: `src/features/session-usage/services/session-usage.mutations.api.ts`

**Interfaces:**
- Consumes: `reconcileOneMembership` (Task 9), `lockMemberMembershipCreation` (existing), `nairobiToday` (Task 1), `requirePermission` (existing), `Result`/`success`/`failure` (existing).
- Produces: `addSessionUsageFn`, `waiveSessionUsageFn` (both `createServerFn`).

- [ ] **Step 1: Schemas**

```ts
// src/features/session-usage/services/schemas.ts
import { z } from "zod";

export const addSessionUsageSchema = z.object({
	membershipId: z.string().min(1, "Membership is required"),
	usageDate: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Usage date must be yyyy-MM-dd" }),
	reason: z.string().trim().min(10, { error: "Reason must be at least 10 characters" }),
});

export const waiveSessionUsageSchema = z.object({
	usageId: z.string().min(1, "Session usage record is required"),
	reason: z.string().trim().min(10, { error: "Reason must be at least 10 characters" }),
});

export type AddSessionUsageSchema = z.infer<typeof addSessionUsageSchema>;
export type WaiveSessionUsageSchema = z.infer<typeof waiveSessionUsageSchema>;
```

- [ ] **Step 2: Server functions**

Follows the same rollback-safe idiom `upgradePaymentFn` uses (`PaymentTransactionError`): return `failure(...)` only for pre-write checks, and throw a local transaction-error class for anything after a write has already happened in the same transaction, since Drizzle commits partial writes on a plain `return` from inside `db.transaction`.

```ts
// src/features/session-usage/services/session-usage.mutations.api.ts
import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { activityLogs, memberMemberships, membershipSessionUsage } from "@/drizzle/schema";
import { lockMemberMembershipCreation } from "@/features/receipts/services/payment.mutations.api";
import { reconcileOneMembership } from "@/features/session-usage/services/reconcile";
import {
	addSessionUsageSchema,
	waiveSessionUsageSchema,
} from "@/features/session-usage/services/schemas";
import { nairobiToday } from "@/lib/nairobi-time";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { requirePermission } from "@/lib/permissions/permissions";
import { failure, success, type Result } from "@/lib/result";

// Mirrors PaymentTransactionError's purpose (see payment.mutations.api.ts):
// returning a failure from inside db.transaction's callback would still let
// Drizzle commit any writes already made before the check — throwing rolls
// them back instead.
class SessionUsageTransactionError extends Error {
	constructor(readonly result: Extract<Result<never>, { success: false }>) {
		super("session usage transaction rolled back");
	}
}

export const addSessionUsageFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(addSessionUsageSchema)
	.handler(
		async ({
			data: { membershipId, usageDate, reason },
			context: {
				user: { id: userId },
			},
		}) => {
			await requirePermission("attendance:adjust-sessions");

			const fail = (error: Parameters<typeof failure>[0]) =>
				new SessionUsageTransactionError({ success: false, error });

			try {
				return await db.transaction(async (tx) => {
					const membership = await tx.query.memberMemberships.findFirst({
						where: eq(memberMemberships.id, membershipId),
					});
					if (!membership) {
						throw fail({ type: "NotFoundError", message: "Membership not found" });
					}
					if (membership.sessionsTotal === null) {
						throw fail({
							type: "ApplicationError",
							message: "This membership is not session-based.",
						});
					}

					await lockMemberMembershipCreation(tx, membership.memberId);

					const windowEnd = membership.originalEndDate ?? membership.endDate;
					if (!windowEnd || usageDate < membership.startDate || usageDate > windowEnd) {
						throw fail({
							type: "ApplicationError",
							message: `Usage date must be between ${membership.startDate} and ${windowEnd ?? "the membership's end date"}.`,
						});
					}
					const today = nairobiToday();
					if (usageDate > today) {
						throw fail({
							type: "ApplicationError",
							message: "Cannot add a session for a future date.",
						});
					}

					const existingUsageRows = await tx
						.select({ id: membershipSessionUsage.id, voidedAt: membershipSessionUsage.voidedAt })
						.from(membershipSessionUsage)
						.where(eq(membershipSessionUsage.membershipId, membershipId));
					const usedCount = existingUsageRows.filter((row) => row.voidedAt === null).length;
					if (usedCount >= membership.sessionsTotal) {
						throw fail({
							type: "ApplicationError",
							message: "This membership has no remaining sessions to add.",
						});
					}

					const existingForDate = await tx.query.membershipSessionUsage.findFirst({
						where: and(
							eq(membershipSessionUsage.membershipId, membershipId),
							eq(membershipSessionUsage.usageDate, usageDate)
						),
					});

					if (existingForDate) {
						if (existingForDate.voidedAt === null) {
							throw fail({
								type: "ConflictError",
								message: "A session is already recorded for this date.",
							});
						}
						await tx
							.update(membershipSessionUsage)
							.set({ voidedAt: null, voidedByUserId: null, voidReason: null, reason })
							.where(eq(membershipSessionUsage.id, existingForDate.id));
					} else {
						await tx.insert(membershipSessionUsage).values({
							membershipId,
							memberId: membership.memberId,
							usageDate,
							source: "manual",
							reason,
							createdByUserId: userId,
						});
					}

					await reconcileOneMembership(tx, membershipId, { actorUserId: userId });

					await tx.insert(activityLogs).values({
						userId,
						action: "add session usage",
						description: `Added a manual session for membership ${membershipId} on ${usageDate}. Reason: ${reason}.`,
					});

					return success(undefined);
				});
			} catch (error) {
				if (error instanceof SessionUsageTransactionError) return error.result;
				console.error(error);
				return failure({ type: "ApplicationError", message: "Failed to add session usage" });
			}
		}
	);

export const waiveSessionUsageFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(waiveSessionUsageSchema)
	.handler(
		async ({
			data: { usageId, reason },
			context: {
				user: { id: userId },
			},
		}) => {
			await requirePermission("attendance:adjust-sessions");

			const fail = (error: Parameters<typeof failure>[0]) =>
				new SessionUsageTransactionError({ success: false, error });

			try {
				return await db.transaction(async (tx) => {
					const usage = await tx.query.membershipSessionUsage.findFirst({
						where: eq(membershipSessionUsage.id, usageId),
					});
					if (!usage) {
						throw fail({ type: "NotFoundError", message: "Session usage record not found" });
					}
					if (usage.voidedAt !== null) {
						throw fail({
							type: "ApplicationError",
							message: "This session has already been waived.",
						});
					}

					await lockMemberMembershipCreation(tx, usage.memberId);

					const now = new Date();
					await tx
						.update(membershipSessionUsage)
						.set({ voidedAt: now, voidedByUserId: userId, voidReason: reason })
						.where(eq(membershipSessionUsage.id, usageId));

					await reconcileOneMembership(tx, usage.membershipId, { actorUserId: userId, now });

					await tx.insert(activityLogs).values({
						userId,
						action: "waive session usage",
						description: `Waived the session for membership ${usage.membershipId} on ${usage.usageDate}. Reason: ${reason}.`,
					});

					return success(undefined);
				});
			} catch (error) {
				if (error instanceof SessionUsageTransactionError) return error.result;
				console.error(error);
				return failure({ type: "ApplicationError", message: "Failed to waive session usage" });
			}
		}
	);
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/session-usage/services/schemas.ts src/features/session-usage/services/session-usage.mutations.api.ts
git commit -m "feat: add manual session add/waive server functions"
```

---

### Task 13: Void guard

**Files:**
- Modify: `src/features/receipts/lib/void.ts`

**Interfaces:**
- Consumes: `membershipSessionUsage` table (Task 2).

- [ ] **Step 1: Write the failing test**

Create `src/features/receipts/lib/void.test.ts` (first test file for this module — matches the `.mock()` convention used in `membership-activation.test.ts`):

```ts
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { membershipSessionUsage } from "@/drizzle/schema";

// checkVoidEligibility itself needs a live tx/db (no DB-backed tests exist in
// this codebase — see AGENTS.md), so this only pins down the exact query shape
// the new guard must issue, the same way membership-activation.test.ts pins
// getDueMembershipConditions's SQL without a real connection.
describe("session usage existence query shape", () => {
	it("filters membership_session_usage by membershipId only (voided rows included)", () => {
		const query = drizzle
			.mock({ casing: "snake_case" })
			.select({ id: membershipSessionUsage.id })
			.from(membershipSessionUsage)
			.where(eq(membershipSessionUsage.membershipId, "m1"))
			.toSQL();
		const normalizedSql = query.sql.toLowerCase().replace(/\s+/g, " ");
		expect(normalizedSql).toContain('"membership_session_usage"."membership_id" = $1');
		expect(normalizedSql).not.toContain("voided_at");
		expect(query.params).toEqual(["m1"]);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/features/receipts/lib/void.test.ts`
Expected: FAIL — `membershipSessionUsage` is not exported from `@/drizzle/schema` yet if Task 2 hasn't landed on this branch; if Task 2 is already merged, this test passes immediately and step 2/4 collapse into one run — that's fine, it's still asserting the exact shape Step 3 below will use.

- [ ] **Step 3: Implement the guard**

In `src/features/receipts/lib/void.ts`, add `membershipSessionUsage` to the existing `@/drizzle/schema` import. Change the `membershipRow` query's `columns` to also select `id` and `sessionsTotal`:

```ts
	const membershipRow = await tx.query.memberMemberships.findFirst({
		where: eq(memberMemberships.paymentId, payment.id),
		columns: { id: true, startDate: true, endDate: true, membershipPlanId: true, sessionsTotal: true },
	});
```

Immediately after the `if (!membershipRow) { ... }` block, before the "later membership" loop, add:

```ts
	// Sessions already recorded against this membership (used or manually
	// waived) make a clean automatic void impossible — see
	// membership_session_usage. Mirrors the upgrade/credit-note checks below:
	// this is a new, additive guard, not a replacement for them.
	if (membershipRow.sessionsTotal !== null) {
		const existingUsage = await tx.query.membershipSessionUsage.findFirst({
			where: eq(membershipSessionUsage.membershipId, membershipRow.id),
			columns: { id: true },
		});
		if (existingUsage) {
			return failure({
				type: "ConflictError",
				message:
					"Sessions have already been recorded against this membership and it cannot be voided automatically — it requires a manual correction.",
			});
		}
	}
```

- [ ] **Step 4: Run test to verify it passes, plus the full receipts test suite**

Run: `pnpm test src/features/receipts`
Expected: PASS, no regressions in existing Void/eligibility tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/receipts/lib/void.ts src/features/receipts/lib/void.test.ts
git commit -m "feat: block automatic void once session usage exists"
```

---

### Task 14: Upgrade guard

**Files:**
- Modify: `src/features/receipts/lib/upgrade.ts`
- Modify: `src/features/receipts/lib/helpers.ts`
- Modify: `src/features/receipts/lib/helpers.test.ts`

**Interfaces:**
- Produces: `isEligibleUpgradePlan`'s `candidatePlan` parameter gains optional `isSessionBased?: boolean`.

- [ ] **Step 1: Write the failing tests**

Add to the existing `describe("isEligibleUpgradePlan", ...)` block in `src/features/receipts/lib/helpers.test.ts`:

```ts
	it("rejects a session-based plan as an upgrade target", () => {
		const sessionPlan = { id: "sessions-10", duration: 90, memberCount: 1, isSessionBased: true };
		const monthlySingle = { id: "monthly-single", duration: 30, memberCount: 1 };
		expect(isEligibleUpgradePlan(sessionPlan, monthlySingle)).toBe(false);
	});

	it("still allows a non-session plan when isSessionBased is omitted (existing callers unaffected)", () => {
		expect(isEligibleUpgradePlan(monthly, fortnight)).toBe(true);
	});
```

- [ ] **Step 2: Run tests to verify the new one fails**

Run: `pnpm test src/features/receipts/lib/helpers.test.ts`
Expected: the session-plan test FAILs (current implementation has no `isSessionBased` check); the "omitted" test already passes.

- [ ] **Step 3: Implement**

In `src/features/receipts/lib/helpers.ts`, change `isEligibleUpgradePlan`:

```ts
export function isEligibleUpgradePlan(
	candidatePlan: { id: string; duration: number; memberCount: number; isSessionBased?: boolean },
	currentPlan: { id: string; duration: number; memberCount: number }
): boolean {
	if (candidatePlan.id === currentPlan.id) return false;
	if (candidatePlan.memberCount !== currentPlan.memberCount) return false;
	if (candidatePlan.isSessionBased) return false;
	return candidatePlan.duration >= currentPlan.duration;
}
```

This single change covers both call sites automatically: the client-side filter in `upgrade-payment-form.tsx:92` (fetched plans already include `isSessionBased`) and the authoritative server check in `payment.mutations.api.ts:748` (`newPlan` is a full `membershipPlans` row).

In `src/features/receipts/lib/upgrade.ts`, in `checkUpgradeEligibility`, immediately after the existing "terminated" check (the `if (memberships.some((membership) => membership.status === "terminated")) { ... }` block) and before the "Expired" computed-check block, add:

```ts
	// Session-based memberships aren't supported by the upgrade flow yet — the
	// top-up/duration-extension model doesn't map onto a fixed session count.
	if (membershipRow.sessionsTotal !== null) {
		return failure({
			type: "ApplicationError",
			message:
				"Session-based memberships cannot be upgraded yet — this membership must run its course or be corrected manually.",
		});
	}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/features/receipts/lib/helpers.test.ts`
Expected: PASS, including all pre-existing `isEligibleUpgradePlan` cases (none of them set `isSessionBased`, so they're unaffected by the new optional field).

- [ ] **Step 5: Commit**

```bash
git add src/features/receipts/lib/upgrade.ts src/features/receipts/lib/helpers.ts src/features/receipts/lib/helpers.test.ts
git commit -m "feat: block upgrades to or from session-based memberships"
```

---

### Task 15: Credit Note guard

**Files:**
- Modify: `src/features/credit-notes/lib/eligibility.ts`

**Interfaces:**
- None new — adds a check using the existing `membership.sessionsTotal` field (available automatically once Task 2 lands, since `checkCreditNoteEligibility`'s `membership` query has no `columns` restriction).

- [ ] **Step 1: Implement**

In `src/features/credit-notes/lib/eligibility.ts`, immediately after the existing:

```ts
	if (membership.status === "terminated") {
		return failure({
			type: "ConflictError",
			message: "This membership has already been terminated.",
		});
	}
```

add:

```ts
	// Credit notes are priced off unused calendar days (computeSuggestedCreditAmount
	// below) — that model doesn't apply to a fixed session count.
	if (membership.sessionsTotal !== null) {
		return failure({
			type: "ApplicationError",
			message: "Credit notes for session-based memberships are not supported yet.",
		});
	}
```

- [ ] **Step 2: Run existing credit-notes tests**

Run: `pnpm test src/features/credit-notes`
Expected: PASS, no regressions (no existing test exercises a session-based membership through this path, since none could exist before this plan).

- [ ] **Step 3: Commit**

```bash
git add src/features/credit-notes/lib/eligibility.ts
git commit -m "feat: block credit notes for session-based memberships"
```

---

### Task 16: Investigate and report the Nairobi/UTC cron date-boundary behavior

This task produces a written finding only — **no code changes**. Do not modify `expireMembershipsAndDisableAccess`, `activateDueMemberships`, or `dateFormat`.

**Files:**
- Modify: this plan file only, by appending the answer under a new `## Task 16 Findings` section at the very bottom (after Task 17).

- [ ] **Step 1: Read the relevant code**

Read:
- `src/routes/api/cron/daily/index.ts` — `expireMembershipsAndDisableAccess` (the `today = dateFormat(now)` line and the `lt(memberMemberships.endDate, today)` filter), and `activateDueMemberships` → `getDueMembershipConditions` in `src/features/receipts/lib/membership-activation.ts` (the `lte(memberMemberships.startDate, dateFormat(today))` filter).
- `src/lib/helpers.ts` — `dateFormat`'s implementation (`format(new Date(date), "yyyy-MM-dd")`, i.e. the Node process's local timezone, which on Vercel is UTC).
- `vercel.json` — confirm the cron fires at `0 21 * * *` UTC.

- [ ] **Step 2: Work out the two boundary cases precisely**

At the 21:00 UTC run on UTC calendar date `D`, `new Date()` is still UTC date `D` (just before midnight UTC), so `dateFormat(now)` returns `D`, not `D+1` — `dateFormat` runs in the server's own local time, and on Vercel that local time's calendar date at 21:00 UTC is still `D`, because UTC *is* the server's local time there. (Nairobi has already rolled over to `D+1` at that instant, but `dateFormat` never looks at Nairobi — it looks at whatever `new Date(date)` renders as in the process's own zone, which is UTC itself.)

Work out, and write down with the reasoning:
- For `expireMembershipsAndDisableAccess`: a membership whose `endDate = D` is compared via `endDate < today` where `today = D` at the 21:00 UTC run — `D < D` is false, so it is **not** expired at that run. It is only expired at the *next* day's 21:00 UTC run, when `today` becomes `D+1` and `D < D+1` is true. State plainly: a membership is expired one full run (one day) later than its Nairobi-calendar last-valid-day would suggest, because the cron's `today` lags Nairobi's calendar date by a day at the moment it fires (it fires at Nairobi midnight, but computes "today" as the UTC date, which only rolls over to `D+1` several hours later).
- For `activateDueMemberships`: a membership with `startDate = D+1` compared via `startDate <= today` — at the 21:00 UTC run (`today = D`), `D+1 <= D` is false, so it does **not** activate yet. It activates at the following run once `today` becomes `D+1`. Since the cron only runs once daily and `D+1`'s Nairobi day has already begun by the time of the `D` run, state whether this means a membership can be inactive (not yet activated) for the first several hours of its own `startDate` in Nairobi time, until the *next* night's run — work out exactly how many hours, given the cron fires once per Nairobi-calendar day at Nairobi midnight but computes dates in UTC.

- [ ] **Step 3: Write the finding**

Append a `## Task 16 Findings` section to the bottom of this plan file with the precise answer to both bullets above (exact day-offset, in plain language, with the reasoning spelled out — not just "yes/no"). State explicitly that this is a pre-existing lag unrelated to session-based plans, and that it is **not** being fixed here, because `expireExhaustedSessionMemberships` (Task 11) is intentionally independent of it (it uses `nairobiToday()`, not `dateFormat`).

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/2026-10-11-session-based-plans-core.md
git commit -m "docs: record Nairobi/UTC cron date-boundary finding"
```

---

### Task 17: Final verification pass

**Files:** none (verification only).

- [ ] **Step 1: Full typecheck**

Run: `pnpm typecheck`
Expected: zero errors across the whole repo.

- [ ] **Step 2: Full test run**

Run: `pnpm test`
Expected: all tests pass, including every new file from Tasks 1, 5, 7, 13, 14.

- [ ] **Step 3: Scoped format/lint check on touched files**

Run: `pnpm check` (Biome), scoped mentally to the files this plan touched (per `AGENTS.md`'s "avoid repo-wide formatting churn" guidance — do not run a repo-wide `pnpm format`).

- [ ] **Step 4: Confirm generated migrations**

Re-open the two generated migration files from Tasks 2 and 3 and confirm: the Task 2 migration contains `CREATE TABLE "membership_session_usage"` plus the two `member_memberships` column additions and nothing else unexpected (no accidental unrelated diff); the Task 3 migration contains exactly the `CREATE VIEW vw_daily_attendance` statement. Confirm neither has been run (`pnpm db:migrate` must **not** have been executed).

- [ ] **Step 5: Compose the final summary**

The final summary handed back to the user must include, verbatim as a checklist:
- A one-line-per-file list of what changed (new files and modified files from every task above).
- `attendance:adjust-sessions` ships unassigned to any role (Task 4's note).
- The Task 16 findings (copy them into the summary, don't just link to this file).
- What `deleteOlderLogs` deletes: **only `activity_logs` (the audit trail)** — confirmed by reading `src/services/activity-logger.ts:44-53`. It never touches `attendance_logs`, so punch history has no automatic retention policy in this codebase; reconciliation always has full history available to recompute from.
- The two read-only SQL queries for the owner to run on production data before enabling any session-based plan, exactly as given below (do not alter them):

```sql
SELECT device_id, count(*), min(check_in_time), max(check_in_time) FROM attendance_logs GROUP BY 1;
```
```sql
SELECT biotime_id, check_in_time, check_in_time AT TIME ZONE 'Africa/Nairobi' AS nairobi_time FROM attendance_logs ORDER BY id DESC LIMIT 20;
```

The first confirms only the entrance terminal is present in `device_id` (the app's config models a single device — see the discovery doc's §1.10/Surprise #7). The second confirms punch instants actually correspond to the wall-clock time they were taken at, since the external BioTime-polling agent's exact timestamp format could not be verified from this repo (see the discovery doc's §1.4).

- [ ] **Step 6: Final commit (if Step 5's checklist required any fixes)**

Only if Steps 1-4 required a fix:

```bash
git add -A
git commit -m "fix: address typecheck/test/lint findings from final verification"
```

---

## Task 16 Findings

**Scope:** this is a read-only investigation. Nothing in `expireMembershipsAndDisableAccess`, `activateDueMemberships`, `dateFormat`, or `getDueMembershipConditions` was changed. The finding below documents a pre-existing lag in the generic (non-session) daily cron logic — code that predates this feature — for the record. It is deliberately **not** being fixed as part of this plan, because Task 11's `expireExhaustedSessionMemberships` sidesteps the whole problem by computing "today" with `nairobiToday()` (an `Intl.DateTimeFormat` pinned to the `Africa/Nairobi` IANA zone) instead of `dateFormat` (which formats via `new Date(date)` in the process's own local zone — UTC, on Vercel). Session-based membership expiry is therefore unaffected by anything described here.

### Setup: confirming the mechanics

- `vercel.json`'s single cron entry fires `/api/cron/daily` on schedule `"0 21 * * *"`. Vercel Cron Jobs are always scheduled in UTC, so this is 21:00 UTC, once per day, with no regard for the project's or the server's own configured timezone.
- `dateFormat` (`src/lib/helpers.ts`) is `format(new Date(date), "yyyy-MM-dd")` — plain `date-fns` formatting with no timezone argument, so it renders the calendar date according to whatever timezone the Node process itself is running in. On Vercel's serverless runtime that process timezone is UTC. So `dateFormat(x)` at any instant returns that instant's **UTC calendar date**, never Nairobi's.
- Nairobi (EAT, Africa/Nairobi) is a fixed UTC+3 offset with no daylight saving. So 21:00 UTC is always exactly 00:00 EAT the *next* UTC calendar day — i.e. the cron fires at exactly the stroke of Nairobi midnight, once every 24 hours.
- `expireMembershipsAndDisableAccess` captures one instant, `const now = new Date(); const today = dateFormat(now);`, and uses it both to call `activateDueMemberships(tx, now)` and to filter expiry with `lt(memberMemberships.endDate, today)`.
- `activateDueMemberships` → `getDueMembershipConditions(today)` filters with `lte(memberMemberships.startDate, dateFormat(today))`.

Call the UTC calendar date on which a given run fires `D`. Because the run fires at 21:00 UTC — before UTC midnight — `dateFormat(now)` at that run evaluates to `D`, not `D+1`. But Nairobi's clock has already rolled over: the same instant is 00:00 EAT on Nairobi calendar date `D+1`. So at the exact moment the cron fires, the code's notion of "today" (`D`, in UTC terms) is **one full day behind** the Nairobi calendar day that has just begun (`D+1`). This is the lag the two questions below quantify.

### Question 1 — `expireMembershipsAndDisableAccess`: how late is expiry?

Take a membership whose `endDate = D` — i.e. a membership meant to remain valid through the entirety of Nairobi calendar day `D`, and to lapse starting Nairobi day `D+1`.

- The run that fires at the exact moment Nairobi day `D+1` begins is, in UTC terms, the run at 21:00 UTC on UTC date `D` (since 00:00 EAT on `D+1` = 21:00 UTC on `D`). At that run, `today = dateFormat(now) = D`. The expiry filter checks `endDate < today`, i.e. `D < D`, which is **false**. So the membership is **not** expired at the very run that coincides with the start of the Nairobi day it should have already lapsed on.
- The membership only gets expired at the *next* run — 24 hours later, at 21:00 UTC on UTC date `D+1` (which is 00:00 EAT on Nairobi day `D+2`). At that run, `today = D+1`, and `D < D+1` is **true**, so expiry happens then.
- Net effect: the membership is expired **one full run — one full Nairobi calendar day — later** than its own `endDate` says it should be. It is treated as still "active" (and the member's access is not revoked) for the entirety of Nairobi day `D+1`, even though `endDate = D` means it should have already lapsed as of the start of `D+1`. The lag is exactly 24 hours, bounded by the cron's own daily cadence, because the comparison uses the UTC calendar date (`D`) at a moment when Nairobi has already advanced to `D+1` — the code never notices the Nairobi rollover until the *following* UTC calendar date arrives, a full day later.

### Question 2 — `activateDueMemberships`: how late is activation?

Take a membership whose `startDate = D+1` — i.e. a membership meant to become active at the start of Nairobi calendar day `D+1`.

- At the run that fires at the exact moment Nairobi day `D+1` begins (21:00 UTC on UTC date `D`, `today = D`), the activation filter checks `startDate <= today`, i.e. `D+1 <= D`, which is **false**. So the membership does **not** activate at the run that coincides with the first instant of its own start date.
- It only activates at the *next* run — 24 hours later, at 21:00 UTC on UTC date `D+1` (00:00 EAT on Nairobi day `D+2`). At that run `today = D+1`, and `D+1 <= D+1` is **true**, so activation happens then.
- Because the cron fires exactly once per Nairobi calendar day, at exactly Nairobi midnight each time, the run that should have activated the membership and the run that actually does are exactly 24 hours apart. The membership therefore sits in `pending` status — inactive, with no access — for the **entire 24-hour span of Nairobi calendar day `D+1`**, its own start date. It is only activated at the very last instant of that lag window, which is simultaneously the first instant of Nairobi day `D+2`. In other words: a membership is unusable for the whole of the first day it was supposed to be valid.

### Summary

Both lags are the same root cause and the same magnitude: the generic cron computes "today" from the UTC calendar date at the moment it fires, but it fires at Nairobi midnight — the instant Nairobi's calendar date has *just* advanced. Because `dateFormat` never looks at the Nairobi zone, the code's "today" is pinned to the UTC date, which only catches up to what Nairobi considers "today" at the *next* day's run, a full 24 hours later. Concretely:

- A membership's expiry (via `endDate`) is delayed by one full Nairobi day: it stays "active" for an extra 24 hours after its stated `endDate` has already ended in Nairobi time.
- A membership's activation (via `startDate`) is delayed by one full Nairobi day: it stays "pending"/inactive for the entire first 24 hours of its own `startDate` in Nairobi time.

This is a **pre-existing behavior** of code that predates the session-based plans feature, and it is **not** being fixed by this plan. It is called out here only because Task 11's `expireExhaustedSessionMemberships` was deliberately written to avoid the same trap for session-based memberships, using `nairobiToday()` (Nairobi-zone-aware via `Intl.DateTimeFormat`) instead of `dateFormat` (UTC-process-local). Session-based membership expiry is therefore exact to the Nairobi calendar day and does not carry this lag; this finding is purely a record of the lag that remains in the generic, non-session `expireMembershipsAndDisableAccess` / `activateDueMemberships` path for day-based memberships.
