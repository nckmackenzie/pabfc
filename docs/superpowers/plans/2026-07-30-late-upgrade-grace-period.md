# Late Upgrade Grace Period Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin (holding a new `receipts:top-up-late` permission) upgrade a payment whose membership has already expired, as long as it's within a per-plan (or global-default) grace period, with a mandatory logged reason — extending the existing Upgrade/Top-up feature rather than forking it.

**Architecture:** Three new nullable/defaulted columns land on `membership_upgrades`, `membershipPlans`, and `settings.billing`. Pure, unit-testable functions in `src/features/receipts/lib/helpers.ts` resolve the grace-days value and decide late-upgrade eligibility; `checkUpgradeEligibility` (the existing shared eligibility helper used by both the loader and the mutation transaction) calls them and gains a new `hasLateUpgradePermission` parameter. `upgradePaymentFn` and `getUpgradeContext` compute that permission boolean via the query layer (not another server-fn round trip) and pass it through. The form renders a banner + required reason textarea only when the loader says the upgrade is late.

**Tech Stack:** TanStack Start (`createServerFn`), Drizzle ORM/PostgreSQL, Zod, TanStack Form/Query, Vitest, date-fns.

## Global Constraints

- Grace period resolves as `originalPlan.lateUpgradeGraceDays ?? settings.billing.lateUpgradeGraceDays ?? 3` — always the plan the member was already on, never the plan being upgraded to. Variable names must say `originalPlan`/`plan`, never imply the new plan.
- Only `memberMemberships.status === "terminated"` (the actual column) makes a membership ineligible for reasons other than the date/grace-period math — the active/expired boundary itself stays on the existing computed `endDate < today` check, not the `status` column (which lags reality until `runMembershipMaintenance` runs).
- Gate everything on the `receipts:top-up-late` permission via the existing `requirePermission`/`userHasPermission` helpers. Never check a literal role name (`user.role === "admin"` is already handled generically inside those helpers).
- Server-side checks are authoritative. Anything client-side (banners, disabled submit buttons) is UX convenience only.
- Do not change the `newEndDate` computation formula (`computeMembershipEndDate`) — only when it's reachable and by whom.
- Generate the Drizzle migration; do not run/apply it.
- If `newEndDate` still falls before today after a late upgrade, warn — never block.

---

### Task 1: Schema — new columns, migration, and permission constant

**Files:**
- Modify: `src/drizzle/schemas/settings.ts:33-44`
- Modify: `src/drizzle/schemas/member.ts:149-170`
- Modify: `src/drizzle/schemas/membership-upgrades.ts:11-47`
- Modify: `src/lib/permissions/constants.ts:33` (the `receipts:*` block)
- Create: a new file under `src/drizzle/migrations/` (name assigned by `drizzle-kit generate`)

**Interfaces:**
- Produces: `membershipPlans.lateUpgradeGraceDays: number | null`, `settings.billing.lateUpgradeGraceDays?: number`, `membershipUpgrades.isLateUpgrade: boolean`, `membershipUpgrades.daysAfterExpiry: number | null`, `membershipUpgrades.lateUpgradeReason: string | null`, and the permission literal `"receipts:top-up-late"` — every later task depends on these existing.

- [ ] **Step 1: Add `lateUpgradeGraceDays` to `settings.billing`'s jsonb type**

In `src/drizzle/schemas/settings.ts`, change the `billing` field's `.$type<...>()` block:

```ts
	billing: jsonb().default({}).$type<{
		invoicePrefix?: string;
		invoiceNumberPadding?: number;
		applyTaxToMembership?: boolean;
		vatType?: VatType;
		vatAccountId?: number;
		autoCreateFinancialYear?: boolean;
		mpesaSettlementAccountId?: number;
		memberCreditsPayableAccountId?: number;
		creditForfeitureIncomeAccountId?: number;
		creditNoteExpiryMonths?: number;
		lateUpgradeGraceDays?: number;
	}>(),
```

- [ ] **Step 2: Add `lateUpgradeGraceDays` to `membershipPlans`**

In `src/drizzle/schemas/member.ts`, inside the `membershipPlans` table definition (right after `revenueAccountId`, before `active`):

```ts
		revenueAccountId: integer("revenue_account_id").references(
			() => ledgerAccounts.id,
		),
		// Per-plan override for how many days after expiry a late upgrade is still
		// allowed. Null means "use settings.billing.lateUpgradeGraceDays instead" —
		// see resolveLateUpgradeGraceDays in features/receipts/lib/helpers.ts.
		lateUpgradeGraceDays: integer("late_upgrade_grace_days"),
		active,
		createdAt,
		updatedAt,
```

- [ ] **Step 3: Add the three new columns to `membershipUpgrades`**

In `src/drizzle/schemas/membership-upgrades.ts`, inside the `membershipUpgrades` table definition, after `notes`:

```ts
		notes: text("notes"),
		// Late-upgrade audit trail — set together, all three null/false for a normal
		// (not-late) upgrade. isLateUpgrade is not-null so it's always queryable
		// without a null check; daysAfterExpiry/lateUpgradeReason are only ever
		// non-null together with isLateUpgrade === true.
		isLateUpgrade: boolean("is_late_upgrade").notNull().default(false),
		daysAfterExpiry: integer("days_after_expiry"),
		lateUpgradeReason: text("late_upgrade_reason"),
		createdByUserId: varchar("created_by_user_id")
			.notNull()
			.references(() => users.id),
		createdAt,
```

Add `boolean` and `integer` to the `drizzle-orm/pg-core` import at the top of the file (currently `date, numeric, pgTable, text, uniqueIndex, varchar`):

```ts
import { boolean, date, integer, numeric, pgTable, text, uniqueIndex, varchar } from "drizzle-orm/pg-core";
```

- [ ] **Step 4: Add the new permission**

In `src/lib/permissions/constants.ts`, in the `receipts:*` group:

```ts
	"receipts:void",
	"receipts:top-up",
	"receipts:top-up-late",
```

**Note for delivery:** `role_permissions` in this codebase is populated at runtime via the app's own Roles & Permissions screen (`src/features/users/services/roles.api.ts`), not via seed data — there is no seed-time role-to-permission assignment anywhere to extend. Once this ships, `receipts:top-up-late` must be granted to the Admin role manually through that screen before any admin can use the late-upgrade path (including for the manual QA in Task 12).

- [ ] **Step 5: Generate the migration**

Run: `npx drizzle-kit generate`

Expected: a new file appears under `src/drizzle/migrations/` containing `ALTER TABLE "membership_plans" ADD COLUMN "late_upgrade_grace_days" integer;` and three `ALTER TABLE "membership_upgrades" ADD COLUMN ...` statements for `is_late_upgrade` (`boolean NOT NULL DEFAULT false`), `days_after_expiry` (`integer`), `lateUpgradeReason`→`late_upgrade_reason` (`text`). The `settings.billing` change is inside a jsonb column and produces no SQL. Do not run this migration.

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors (drizzle-kit's generated meta/snapshot files are excluded from typecheck as usual).

- [ ] **Step 7: Commit**

```bash
git add src/drizzle/schemas/settings.ts src/drizzle/schemas/member.ts src/drizzle/schemas/membership-upgrades.ts src/drizzle/migrations src/lib/permissions/constants.ts
git commit -m "Add late-upgrade schema columns and receipts:top-up-late permission"
```

---

### Task 2: Pure helper functions for grace-period resolution and eligibility

**Files:**
- Modify: `src/features/receipts/lib/helpers.ts`
- Test: `src/features/receipts/lib/helpers.test.ts`

**Interfaces:**
- Consumes: nothing new (pure functions, no DB).
- Produces:
  - `resolveLateUpgradeGraceDays(originalPlan: { lateUpgradeGraceDays: number | null }, globalDefaultDays: number | null | undefined): number`
  - `computeDaysLate(endDate: string, today: string): number`
  - `type LateUpgradeDecision = { eligible: true; daysLate: number; graceDaysAllowed: number } | { eligible: false; reason: string }`
  - `evaluateLateUpgradeEligibility(input: { daysLate: number; graceDaysAllowed: number; hasLateUpgradePermission: boolean }): LateUpgradeDecision`
  - Task 3 (`checkUpgradeEligibility`) imports and calls all three.

- [ ] **Step 1: Write the failing tests**

Append to `src/features/receipts/lib/helpers.test.ts` (add `resolveLateUpgradeGraceDays`, `computeDaysLate`, `evaluateLateUpgradeEligibility` to the existing import block at the top of the file, alongside `isEligibleUpgradePlan`):

```ts
describe("resolveLateUpgradeGraceDays", () => {
	it("uses the plan-level override when set", () => {
		expect(resolveLateUpgradeGraceDays({ lateUpgradeGraceDays: 7 }, 3)).toBe(7);
	});

	it("falls back to the global default when the plan has no override", () => {
		expect(resolveLateUpgradeGraceDays({ lateUpgradeGraceDays: null }, 5)).toBe(5);
	});

	it("falls back to 3 when neither the plan override nor the global default is set", () => {
		expect(resolveLateUpgradeGraceDays({ lateUpgradeGraceDays: null }, undefined)).toBe(3);
		expect(resolveLateUpgradeGraceDays({ lateUpgradeGraceDays: null }, null)).toBe(3);
	});

	it("treats a plan override of 0 as a real value, not a missing one", () => {
		expect(resolveLateUpgradeGraceDays({ lateUpgradeGraceDays: 0 }, 5)).toBe(0);
	});
});

describe("computeDaysLate", () => {
	it("returns the number of calendar days between endDate and today", () => {
		expect(computeDaysLate("2026-07-01", "2026-07-05")).toBe(4);
	});

	it("returns 0 when endDate is today", () => {
		expect(computeDaysLate("2026-07-05", "2026-07-05")).toBe(0);
	});

	it("returns a large value for a long-expired membership", () => {
		expect(computeDaysLate("2026-01-01", "2026-07-05")).toBe(185);
	});
});

describe("evaluateLateUpgradeEligibility", () => {
	it("is ineligible when daysLate exceeds graceDaysAllowed, regardless of permission", () => {
		const result = evaluateLateUpgradeEligibility({
			daysLate: 5,
			graceDaysAllowed: 3,
			hasLateUpgradePermission: true,
		});
		expect(result.eligible).toBe(false);
	});

	it("is ineligible within the grace period when the user lacks the late-upgrade permission", () => {
		const result = evaluateLateUpgradeEligibility({
			daysLate: 2,
			graceDaysAllowed: 3,
			hasLateUpgradePermission: false,
		});
		expect(result.eligible).toBe(false);
	});

	it("is eligible within the grace period when the user holds the late-upgrade permission", () => {
		const result = evaluateLateUpgradeEligibility({
			daysLate: 2,
			graceDaysAllowed: 3,
			hasLateUpgradePermission: true,
		});
		expect(result).toEqual({ eligible: true, daysLate: 2, graceDaysAllowed: 3 });
	});

	it("is eligible exactly on the last day of the grace period", () => {
		const result = evaluateLateUpgradeEligibility({
			daysLate: 3,
			graceDaysAllowed: 3,
			hasLateUpgradePermission: true,
		});
		expect(result.eligible).toBe(true);
	});

	it("is ineligible the day after the grace period ends", () => {
		const result = evaluateLateUpgradeEligibility({
			daysLate: 4,
			graceDaysAllowed: 3,
			hasLateUpgradePermission: true,
		});
		expect(result.eligible).toBe(false);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/receipts/lib/helpers.test.ts`
Expected: FAIL — `resolveLateUpgradeGraceDays`, `computeDaysLate`, `evaluateLateUpgradeEligibility` are not exported from `./helpers`.

- [ ] **Step 3: Implement the pure functions**

In `src/features/receipts/lib/helpers.ts`, add `differenceInCalendarDays` to the existing `date-fns` import (currently `import { addDays, parseISO } from "date-fns";`):

```ts
import { addDays, differenceInCalendarDays, parseISO } from "date-fns";
```

Append these exports at the end of the file (after `splitAmountEvenly`):

```ts
// Resolves the grace period for a late upgrade: the plan the member was
// already on can override the global default; null on the plan means
// "use the global default." Always called with the *original* plan — a
// late upgrade's allowance is governed by what the member is leaving,
// never by what they're upgrading to.
export function resolveLateUpgradeGraceDays(
	originalPlan: { lateUpgradeGraceDays: number | null },
	globalDefaultDays: number | null | undefined
): number {
	return originalPlan.lateUpgradeGraceDays ?? globalDefaultDays ?? 3;
}

// Calendar-day distance between an already-passed endDate and today. Both
// arguments are "yyyy-MM-dd" strings, parsed as local calendar dates (see
// parseCalendarDate) so this isn't sensitive to time-of-day or timezone.
export function computeDaysLate(endDate: string, today: string): number {
	return differenceInCalendarDays(parseCalendarDate(today), parseCalendarDate(endDate));
}

export type LateUpgradeDecision =
	| { eligible: true; daysLate: number; graceDaysAllowed: number }
	| { eligible: false; reason: string };

// Pure decision function for whether an already-expired membership can still
// be upgraded: within the grace period AND the requester holds
// receipts:top-up-late. Exceeding the grace period is always a hard no,
// independent of permission — this mirrors task.md's ordering (grace period
// checked before permission) so the two failure messages stay distinguishable.
export function evaluateLateUpgradeEligibility({
	daysLate,
	graceDaysAllowed,
	hasLateUpgradePermission,
}: {
	daysLate: number;
	graceDaysAllowed: number;
	hasLateUpgradePermission: boolean;
}): LateUpgradeDecision {
	if (daysLate > graceDaysAllowed) {
		return {
			eligible: false,
			reason: `This membership expired ${daysLate} day(s) ago, exceeding the ${graceDaysAllowed}-day grace period — the member must renew instead.`,
		};
	}
	if (!hasLateUpgradePermission) {
		return {
			eligible: false,
			reason: `This membership expired ${daysLate} day(s) ago and requires admin approval to upgrade.`,
		};
	}
	return { eligible: true, daysLate, graceDaysAllowed };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/receipts/lib/helpers.test.ts`
Expected: PASS, all tests including the pre-existing ones.

- [ ] **Step 5: Commit**

```bash
git add src/features/receipts/lib/helpers.ts src/features/receipts/lib/helpers.test.ts
git commit -m "Add pure grace-period and late-upgrade-eligibility helpers"
```

---

### Task 3: Extend `checkUpgradeEligibility` with the late-upgrade branch

**Files:**
- Modify: `src/features/receipts/lib/upgrade.ts`

**Interfaces:**
- Consumes: `resolveLateUpgradeGraceDays`, `computeDaysLate`, `evaluateLateUpgradeEligibility` from Task 2 (`@/features/receipts/lib/helpers`).
- Produces: `checkUpgradeEligibility(dbOrTx, paymentId: string, hasLateUpgradePermission: boolean): Promise<Result<UpgradeEligibility>>` where `UpgradeEligibility` now includes `isLate: boolean`, `daysLate: number | null`, `graceDaysAllowed: number | null`. Tasks 5 and 6 call this with the new third argument and read the new fields.

- [ ] **Step 1: Update imports and the `UpgradeEligibility` type**

In `src/features/receipts/lib/upgrade.ts`, update the import block:

```ts
import { eq, or } from "drizzle-orm";
import {
	memberMemberships,
	membershipPlans,
	membershipUpgrades,
	payments,
	paymentMembers,
	settings,
} from "@/drizzle/schema";
import type { DbClient } from "@/features/receipts/lib/eligibility";
import { findLaterMembership } from "@/features/receipts/lib/eligibility";
import {
	computeDaysLate,
	evaluateLateUpgradeEligibility,
	resolveLateUpgradeGraceDays,
} from "@/features/receipts/lib/helpers";
import { dateFormat } from "@/lib/helpers";
import { failure, success, type Result } from "@/lib/result";
```

Update `UpgradeEligibility`:

```ts
export type UpgradeEligibility = {
	payment: UpgradeEligiblePayment;
	plan: UpgradeEligiblePlan;
	memberships: UpgradeEligibleMembership[];
	coveredMembers: { id: string; name: string }[];
	billingMemberId: string;
	originalStartDate: string;
	originalNumberOfPeriods: number;
	isLate: boolean;
	daysLate: number | null;
	graceDaysAllowed: number | null;
};
```

- [ ] **Step 2: Change the function signature and replace the expiry check**

Change the signature:

```ts
export async function checkUpgradeEligibility(
	dbOrTx: DbClient,
	paymentId: string,
	hasLateUpgradePermission: boolean
): Promise<Result<UpgradeEligibility>> {
```

Replace this existing block (the current unconditional expiry rejection):

```ts
	// Only an active membership (end date not yet due) can be topped up — an already
	// expired one needs a fresh renewal payment instead. Same "expired" definition
	// runMembershipMaintenance uses (endDate < today) rather than trusting the stored
	// `status` column, which only gets flipped when that maintenance job next runs.
	const today = dateFormat(new Date());
	if (membershipRow.endDate && membershipRow.endDate < today) {
		return failure({
			type: "ApplicationError",
			message: `This membership already expired on ${membershipRow.endDate} and cannot be upgraded — the member must renew instead.`,
		});
	}
```

with:

```ts
	// A terminated membership (e.g. closed early via a credit note — see
	// credit-note.mutations.api.ts) is never eligible, late-upgrade grace period or
	// not. This is a real state change, not date-derived, so it's checked against
	// the actual column rather than computed like the active/expired boundary below.
	if (membershipRow.status === "terminated") {
		return failure({
			type: "ApplicationError",
			message: "This membership was terminated and cannot be upgraded.",
		});
	}

	// "Expired" stays a computed check (endDate < today) rather than trusting the
	// stored `status` column, which only flips active→expired once
	// runMembershipMaintenance next runs and can lag the real date. `plan` here is
	// the member's *original* plan — its lateUpgradeGraceDays override (never the
	// new/target plan's) governs the grace period, per task.md.
	const today = dateFormat(new Date());
	let isLate = false;
	let daysLate: number | null = null;
	let graceDaysAllowed: number | null = null;

	if (membershipRow.endDate && membershipRow.endDate < today) {
		const settingsRow = await dbOrTx.query.settings.findFirst({
			columns: { billing: true },
		});
		const resolvedGraceDays = resolveLateUpgradeGraceDays(
			plan,
			settingsRow?.billing?.lateUpgradeGraceDays
		);
		const decision = evaluateLateUpgradeEligibility({
			daysLate: computeDaysLate(membershipRow.endDate, today),
			graceDaysAllowed: resolvedGraceDays,
			hasLateUpgradePermission,
		});
		if (!decision.eligible) {
			return failure({ type: "ApplicationError", message: decision.reason });
		}
		isLate = true;
		daysLate = decision.daysLate;
		graceDaysAllowed = decision.graceDaysAllowed;
	}
```

- [ ] **Step 3: Include the new fields in the success payload**

Replace the final `return success({...})`:

```ts
	return success({
		payment,
		plan,
		memberships,
		coveredMembers,
		billingMemberId: payment.memberId,
		originalStartDate: membershipRow.startDate,
		originalNumberOfPeriods: payment.numberOfPeriods,
		isLate,
		daysLate,
		graceDaysAllowed,
	});
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: errors at the two call sites (`payments.queries.api.ts`, `payment.mutations.api.ts`) for the missing third argument — this is expected and fixed in Tasks 5–6. Confirm there are no *other* new errors in `upgrade.ts` itself.

- [ ] **Step 5: Commit**

```bash
git add src/features/receipts/lib/upgrade.ts
git commit -m "Extend checkUpgradeEligibility with terminated and late-upgrade branches"
```

---

### Task 4: Add `lateUpgradeReason` to the upgrade payment schema

**Files:**
- Modify: `src/features/receipts/services/schemas.ts:52-59`

**Interfaces:**
- Produces: `UpgradePaymentSchema` gains `lateUpgradeReason: string | null`. Task 6 (server) and Task 7 (form) both read/write this field.

- [ ] **Step 1: Add the field**

```ts
export const upgradePaymentSchema = z.object({
	originalPaymentId: requiredStringNonLowerSchemaEntry("Original payment is required"),
	newPlanId: requiredStringNonLowerSchemaEntry("New plan is required"),
	topUpAmount: requiredNumberSchemaEntry("Top-up amount is required"),
	reference: requiredStringNonLowerSchemaEntry("Payment reference is required"),
	upgradeDate: z.iso.date({ error: "Upgrade date is required" }),
	notes: nullableTrimmedString,
	// Only required when the eligibility check marks this as a late upgrade — the
	// schema can't know that on its own (it isn't derivable from the submitted
	// fields), so this stays optional here. The server enforces the minimum length
	// imperatively in upgradePaymentFn once eligibility.data.isLate is known,
	// mirroring voidPaymentSchema's voidReason minimum (10 chars).
	lateUpgradeReason: nullableTrimmedString,
});
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors from this file itself (the two call-site errors from Task 3 remain until Tasks 5–6).

- [ ] **Step 3: Commit**

```bash
git add src/features/receipts/services/schemas.ts
git commit -m "Add optional lateUpgradeReason field to upgradePaymentSchema"
```

---

### Task 5: Wire `hasLateUpgradePermission` and late fields through `getUpgradeContext`

**Files:**
- Modify: `src/features/receipts/services/payments.queries.api.ts:1-17,204-249`

**Interfaces:**
- Consumes: `checkUpgradeEligibility(dbOrTx, paymentId, hasLateUpgradePermission)` from Task 3; `userHasPermission(userId, role, permission)` from `@/lib/permissions/permission-queries`.
- Produces: `getUpgradeContext`'s `eligible: true` branch gains `isLate: boolean`, `daysLate: number | null`, `graceDaysAllowed: number | null`. Task 7 (form) reads these off `upgradeContext`.

- [ ] **Step 1: Import `userHasPermission`**

Add to the top-of-file imports in `src/features/receipts/services/payments.queries.api.ts`:

```ts
import { userHasPermission } from "@/lib/permissions/permission-queries";
```

- [ ] **Step 2: Compute the permission boolean and pass it through**

Replace the `getUpgradeContext` handler body:

```ts
export const getUpgradeContext = createServerFn()
	.middleware([authMiddleware])
	.validator((id: string) => id)
	.handler(async ({ data: id, context: { user } }) => {
		await requirePermission("receipts:top-up");

		const hasLateUpgradePermission = await userHasPermission(
			user.id,
			user.role,
			"receipts:top-up-late"
		);
		const eligibility = await checkUpgradeEligibility(db, id, hasLateUpgradePermission);
		if (!eligibility.success) {
			return { eligible: false as const, reason: eligibility.error.message };
		}

		const {
			payment,
			plan,
			coveredMembers,
			originalStartDate,
			originalNumberOfPeriods,
			memberships,
			isLate,
			daysLate,
			graceDaysAllowed,
		} = eligibility.data;

		return {
			eligible: true as const,
			payment: {
				id: payment.id,
				paymentNo: payment.paymentNo,
				amount: payment.amount,
				numberOfPeriods: payment.numberOfPeriods,
				reference: payment.reference,
			},
			plan: {
				id: plan.id,
				name: plan.name,
				price: plan.price,
				duration: plan.duration,
				memberCount: plan.memberCount,
			},
			coveredMembers,
			originalStartDate,
			originalEndDate: memberships[0]?.endDate ?? null,
			originalNumberOfPeriods,
			isLate,
			daysLate,
			graceDaysAllowed,
		};
	});
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: this call site's error from Task 3 is now resolved. The `upgradePaymentFn` call site error (Task 3) remains until Task 6.

- [ ] **Step 4: Commit**

```bash
git add src/features/receipts/services/payments.queries.api.ts
git commit -m "Pass late-upgrade permission and fields through getUpgradeContext"
```

---

### Task 6: Extend `upgradePaymentFn` — permission, reason validation, warning, audit fields

**Files:**
- Modify: `src/features/receipts/services/payment.mutations.api.ts:1-70,633-913`

**Interfaces:**
- Consumes: `checkUpgradeEligibility(tx, originalPaymentId, hasLateUpgradePermission)` from Task 3; `userHasPermission` from `@/lib/permissions/permission-queries`; `lateUpgradeReason` from `UpgradePaymentSchema` (Task 4).
- Produces: `upgradePaymentFn`'s success payload changes from `Result<string>` (bare payment id) to `Result<{ id: string; warning: string | null }>`. Task 7 (form) must read `result.data.id` / `result.data.warning` instead of `result.data` directly.

- [ ] **Step 1: Import `userHasPermission`**

Add to the imports in `src/features/receipts/services/payment.mutations.api.ts` (alongside the existing `requirePermission` import from `@/lib/permissions/permissions`):

```ts
import { userHasPermission } from "@/lib/permissions/permission-queries";
```

- [ ] **Step 2: Destructure `lateUpgradeReason` and the requesting user's role**

Change the handler's parameter destructuring:

```ts
		async ({
			data: { originalPaymentId, newPlanId, topUpAmount, reference, upgradeDate, notes, lateUpgradeReason },
			context: {
				user: { id: userId, role },
			},
		}) => {
```

- [ ] **Step 3: Compute the permission boolean and pass it into the eligibility call**

Replace:

```ts
					const eligibility = await checkUpgradeEligibility(tx, originalPaymentId);
					if (!eligibility.success) {
						throw new PaymentTransactionError(eligibility);
					}
					const {
						payment: originalPayment,
						plan: originalPlan,
						memberships,
						coveredMembers,
						billingMemberId,
						originalStartDate,
						originalNumberOfPeriods,
					} = eligibility.data;
```

with:

```ts
					const hasLateUpgradePermission = await userHasPermission(
						userId,
						role,
						"receipts:top-up-late"
					);
					const eligibility = await checkUpgradeEligibility(
						tx,
						originalPaymentId,
						hasLateUpgradePermission
					);
					if (!eligibility.success) {
						throw new PaymentTransactionError(eligibility);
					}
					const {
						payment: originalPayment,
						plan: originalPlan,
						memberships,
						coveredMembers,
						billingMemberId,
						originalStartDate,
						originalNumberOfPeriods,
						isLate,
						daysLate,
						graceDaysAllowed,
					} = eligibility.data;

					// The eligibility check already confirmed grace-period + permission when
					// isLate is true; this only enforces that a reason was actually supplied,
					// same minimum-length convention as voidPaymentSchema's voidReason.
					if (isLate) {
						const trimmedReason = lateUpgradeReason?.trim() ?? "";
						if (trimmedReason.length < 10) {
							throw fail({
								type: "ApplicationError",
								message: "A reason (at least 10 characters) is required for a late upgrade.",
							});
						}
					}
```

(`graceDaysAllowed` is destructured for symmetry/readability even though this task doesn't read it further — it mirrors what `getUpgradeContext` exposes.)

- [ ] **Step 4: Compute the post-upgrade warning and change the success return shape**

Locate the final block of the handler:

```ts
					await tx.insert(membershipUpgrades).values({
						originalPaymentId,
						upgradePaymentId: newPayment.id,
						memberId: billingMemberId,
						originalPlanId: originalPlan.id,
						newPlanId,
						originalEndDate: memberships[0]?.endDate ?? null,
						newEndDate: dateFormat(newEndDate),
						topUpAmount: toDecimalString(topUpAmount),
						upgradeDate,
						notes: notes ?? null,
						createdByUserId: userId,
					});

					await tx.insert(activityLogs).values({
						userId,
						action: "upgrade membership",
						description: `Upgraded receipt ${originalPayment.paymentNo} from ${originalPlan.name} to ${newPlan.name} via top-up receipt ${paymentNo}. Affected member(s): ${coveredMembers.map((member) => member.name).join(", ")}.`,
					});

					return success(newPayment.id);
				});
```

Replace it with:

```ts
					const trimmedLateReason = lateUpgradeReason?.trim() || null;

					await tx.insert(membershipUpgrades).values({
						originalPaymentId,
						upgradePaymentId: newPayment.id,
						memberId: billingMemberId,
						originalPlanId: originalPlan.id,
						newPlanId,
						originalEndDate: memberships[0]?.endDate ?? null,
						newEndDate: dateFormat(newEndDate),
						topUpAmount: toDecimalString(topUpAmount),
						upgradeDate,
						notes: notes ?? null,
						createdByUserId: userId,
						isLateUpgrade: isLate,
						daysAfterExpiry: isLate ? daysLate : null,
						lateUpgradeReason: isLate ? trimmedLateReason : null,
					});

					// Informational only — the recomputed end date can still land before
					// today for a sufficiently overdue late upgrade. The upgrade itself is
					// never blocked on this; the caller just needs to see it clearly.
					const lateSuffix = isLate
						? ` LATE UPGRADE (${daysLate} day(s) after expiry). Reason: ${trimmedLateReason}.`
						: "";
					await tx.insert(activityLogs).values({
						userId,
						action: "upgrade membership",
						description: `Upgraded receipt ${originalPayment.paymentNo} from ${originalPlan.name} to ${newPlan.name} via top-up receipt ${paymentNo}. Affected member(s): ${coveredMembers.map((member) => member.name).join(", ")}.${lateSuffix}`,
					});

					const warning =
						dateFormat(newEndDate) < dateFormat(new Date())
							? `The recomputed membership end date (${dateFormat(newEndDate)}) is still before today — the member may need a new payment to regain access.`
							: null;

					return success({ id: newPayment.id, warning });
				});
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors from `upgrade.ts`/`payments.queries.api.ts`/`payment.mutations.api.ts`. New errors will surface in `upgrade-payment-form.tsx` (`result.data` used as a bare string) — expected, fixed in Task 7.

- [ ] **Step 6: Run the existing test suite**

Run: `npx vitest run`
Expected: PASS (no test in this repo currently exercises `upgradePaymentFn` directly against a live DB, so this mainly guards against a typo breaking an unrelated import graph).

- [ ] **Step 7: Commit**

```bash
git add src/features/receipts/services/payment.mutations.api.ts
git commit -m "Enforce late-upgrade reason/permission and record audit fields in upgradePaymentFn"
```

---

### Task 7: Update the upgrade form — new return shape, late banner, reason field, end-date warning

**Files:**
- Modify: `src/features/receipts/components/upgrade-payment-form.tsx`

**Interfaces:**
- Consumes: `upgradeContext.isLate/daysLate/graceDaysAllowed` (Task 5), `UpgradePaymentSchema.lateUpgradeReason` (Task 4), `upgradeMutation`'s success shape `{ id: string; warning: string | null }` (Task 6).
- Produces: nothing new consumed by later tasks — this is a leaf UI task.

- [ ] **Step 1: Fix the `onSuccess` handler for the new `{ id, warning }` shape**

Replace the `onSubmit` handler's `onSuccess` callback:

```ts
		onSubmit: ({ value }) => {
			setSubmissionError(null);
			upgradeMutation.mutate(value, {
				onSuccess: (result) => {
					if (!result.success) {
						setSubmissionError(result.error.message);
						return;
					}
					queryClient.invalidateQueries({ queryKey: ["receipts"] });
					toast.success((t) => (
						<ToastContent
							t={t}
							title="Membership upgraded"
							message="The membership has been upgraded successfully."
						/>
					));
					if (result.data.warning) {
						toast((t) => (
							<ToastContent t={t} title="Note" message={result.data.warning as string} />
						));
					}
					navigate({
						to: "/app/receipts/$receiptId/details",
						params: { receiptId: result.data.id },
					});
				},
			});
		},
```

- [ ] **Step 2: Destructure the late-upgrade fields from `upgradeContext` and add the reason field to default values**

In `EligibleUpgradeForm`, update the destructure:

```ts
	const {
		payment,
		plan: currentPlan,
		coveredMembers,
		originalStartDate,
		originalEndDate,
		isLate,
		daysLate,
		graceDaysAllowed,
	} = upgradeContext;
```

Update `form`'s `defaultValues`:

```ts
		defaultValues: {
			originalPaymentId: payment.id,
			newPlanId: "",
			topUpAmount: 0,
			reference: "",
			upgradeDate: format(new Date(), "yyyy-MM-dd"),
			notes: "",
			lateUpgradeReason: "",
		} as UpgradePaymentSchema,
```

- [ ] **Step 3: Track the reason field and compute the submit-disable condition**

Add to the existing `useStore` block (currently pulling `newPlanId`, `topUpAmount`, `reference`):

```ts
	const [newPlanId, topUpAmount, reference, lateUpgradeReason] = useStore(form.store, (state) => [
		state.values.newPlanId,
		state.values.topUpAmount,
		state.values.reference,
		state.values.lateUpgradeReason,
	]);
	const lateReasonTooShort = isLate && (lateUpgradeReason?.trim().length ?? 0) < 10;
```

- [ ] **Step 4: Compute the raw new-end-date for the "still expired" warning**

The component already computes `newMembershipDates` for display. Add a raw (non-formatted) version alongside it, replacing:

```ts
	const newMembershipDates = selectedPlan
		? {
				startDate: format(parseISO(originalStartDate), "PP"),
				endDate: format(
					computeMembershipEndDate(
						originalStartDate,
						selectedPlan.duration,
						payment.numberOfPeriods
					),
					"PP"
				),
			}
		: { startDate: "", endDate: "" };
```

with:

```ts
	const newEndDateRaw = selectedPlan
		? computeMembershipEndDate(originalStartDate, selectedPlan.duration, payment.numberOfPeriods)
		: null;
	const newMembershipDates = selectedPlan
		? {
				startDate: format(parseISO(originalStartDate), "PP"),
				endDate: format(newEndDateRaw as Date, "PP"),
			}
		: { startDate: "", endDate: "" };
	const willStillBeExpired =
		!!newEndDateRaw && format(newEndDateRaw, "yyyy-MM-dd") < format(new Date(), "yyyy-MM-dd");
```

- [ ] **Step 5: Render the late-upgrade banner and required reason textarea**

In the JSX, immediately after the opening `<PageHeader ... />` and before the `<form onSubmit=...>`, add:

```tsx
			{isLate && (
				<CustomAlert
					variant="warning"
					title="This is a late upgrade"
					description={`This membership expired ${daysLate} day(s) ago (grace period: ${graceDaysAllowed} day(s)). Proceeding will be logged as a late upgrade.`}
				/>
			)}
```

Inside the form's first `<FieldGroup>` block (the one currently containing `notes`), add the reason field right after it, only when late:

```tsx
									<FieldGroup>
										<form.AppField name="notes">
											{(field) => <field.Textarea label="Notes" placeholder="Optional notes" />}
										</form.AppField>
									</FieldGroup>
									{isLate && (
										<FieldGroup>
											<form.AppField name="lateUpgradeReason">
												{(field) => (
													<field.Textarea
														label="Reason for late upgrade"
														placeholder="Explain why this late upgrade is being approved (min. 10 characters)"
														required
													/>
												)}
											</form.AppField>
										</FieldGroup>
									)}
```

Add the "still expired" warning near `<PaymentSummary />` — wrap the existing `<div className="lg:sticky lg:top-6">` contents:

```tsx
							<div className="lg:sticky lg:top-6 space-y-4">
								{willStillBeExpired && (
									<CustomAlert
										variant="warning"
										title="Still expired after this upgrade"
										description={`This will still show as expired as of ${newMembershipDates.endDate} — the member may need a new payment to regain access.`}
									/>
								)}
								<PaymentSummary
									mode="membership"
									memberName={memberName}
									reference={reference}
									currentPlanName={currentPlan.name}
									currentPeriodStart={format(parseISO(originalStartDate), "PP")}
									currentPeriodEnd={originalEndDate ? format(parseISO(originalEndDate), "PP") : "—"}
									newPlanName={selectedPlan?.name ?? ""}
									newPeriodStart={newMembershipDates.startDate}
									newPeriodEnd={newMembershipDates.endDate}
									planPrice={topUpAmount}
									amountDue={topUpAmount}
									taxAmount={topUpTax.taxAmount}
									membershipTotal={topUpTax.totalInclusiveTax}
								/>
							</div>
```

- [ ] **Step 6: Disable submit until the reason is filled, when late**

Update the `<form.SubmitButton />` usage:

```tsx
						<form.SubmitButton
							buttonText="Upgrade Membership"
							isLoading={upgradeMutation.isPending}
							disabled={lateReasonTooShort}
						/>
```

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: clean — this resolves the `result.data` errors introduced by Task 6.

- [ ] **Step 8: Commit**

```bash
git add src/features/receipts/components/upgrade-payment-form.tsx
git commit -m "Render late-upgrade banner, reason field, and end-date warning in the upgrade form"
```

---

### Task 8: Admit expired memberships into the `payment-details.tsx` button gate for late-upgrade-permitted users

**Files:**
- Modify: `src/features/receipts/components/payment-details.tsx:26-32`

**Interfaces:**
- Consumes: `hasPermission` from `usePermissions()` (already imported in this file).
- Produces: nothing new consumed elsewhere — leaf task.

- [ ] **Step 1: Extend `canParticipateInUpgrade`**

Replace:

```ts
	// The banner query only needs view access; the eligibility query is gated on
	// receipts:top-up too, since getUpgradeContext requires it server-side — checking
	// client-side first avoids a guaranteed-to-fail request for staff without it.
	// The endDate check mirrors checkUpgradeEligibility's server-side rule (only an
	// active membership — end date not yet due — can be topped up) so an expired
	// membership doesn't even trigger the eligibility round trip.
	const today = dateFormat(new Date());
	const isMembershipStillActive = !payment.membership?.endDate || payment.membership.endDate >= today;
	const canParticipateInUpgrade =
		payment.status === "completed" && !!payment.planId && isMembershipStillActive;
```

with:

```ts
	// The banner query only needs view access; the eligibility query is gated on
	// receipts:top-up too, since getUpgradeContext requires it server-side — checking
	// client-side first avoids a guaranteed-to-fail request for staff without it.
	// The endDate check mirrors checkUpgradeEligibility's server-side rule (only an
	// active membership — end date not yet due — can be topped up) so an expired
	// membership doesn't trigger the eligibility round trip for staff who couldn't
	// use it anyway. Holders of receipts:top-up-late are let through regardless —
	// whether the grace period/permission actually make it eligible is resolved by
	// the upgradeContext query below, same as every other upgrade nuance.
	const today = dateFormat(new Date());
	const isMembershipStillActive = !payment.membership?.endDate || payment.membership.endDate >= today;
	const canParticipateInUpgrade =
		payment.status === "completed" &&
		!!payment.planId &&
		(isMembershipStillActive || hasPermission("receipts:top-up-late"));
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/features/receipts/components/payment-details.tsx
git commit -m "Let receipts:top-up-late holders reach the upgrade eligibility check on expired memberships"
```

---

### Task 9: Global default grace-days endpoint + wire into the plans route context

**Files:**
- Modify: `src/features/settings/services/settings.api.ts:1-49`
- Modify: `src/features/settings/services/queries.ts`
- Modify: `src/routes/app/plans/route.tsx`

**Interfaces:**
- Produces: `getLateUpgradeGraceDaysDefault(): Promise<number>` (server fn), `lateUpgradeGraceDaysDefaultQuery(): QueryOptions<number>`, and route context `{ accounts, lateUpgradeGraceDaysDefault: number }` available via `useRouteContext({ from: "/app/plans" })`. Task 10 (`PlanForm`) consumes the route context value.

- [ ] **Step 1: Add the narrowly-scoped server function**

In `src/features/settings/services/settings.api.ts`, add the import (alongside the existing ones):

```ts
import { requireAnyPermission } from "@/lib/permissions/permissions";
```

Add this export right after `getSettings` (after line 49):

```ts
// Narrowly-scoped read for PlanForm's helper text — plan creators/editors aren't
// necessarily admins (unlike getSettings above), but they still need to know the
// current global default so "leave blank to use the default" isn't a guess. Returns
// only the one number, not the rest of billing settings.
export const getLateUpgradeGraceDaysDefault = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.handler(async () => {
		await requireAnyPermission(["plans:create", "plans:update"]);
		const settingsRow = await db.query.settings.findFirst({
			columns: { billing: true },
		});
		return settingsRow?.billing?.lateUpgradeGraceDays ?? 3;
	});
```

- [ ] **Step 2: Add the query options**

In `src/features/settings/services/queries.ts`:

```ts
import { queryOptions } from "@tanstack/react-query";
import { getLateUpgradeGraceDaysDefault, getSettings } from "@/features/settings/services/settings.api";

export const settingsQuery = () =>
	queryOptions({
		queryKey: ["settings"],
		queryFn: () => getSettings(),
	});

export const lateUpgradeGraceDaysDefaultQuery = () =>
	queryOptions({
		queryKey: ["settings", "late-upgrade-grace-days-default"],
		queryFn: () => getLateUpgradeGraceDaysDefault(),
	});
```

- [ ] **Step 3: Wire it into the plans route's `beforeLoad` context**

Replace `src/routes/app/plans/route.tsx`:

```tsx
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AlertErrorComponent } from "@/components/ui/error-component";
import { accountQueries } from "@/features/coa/services/queries";
import { lateUpgradeGraceDaysDefaultQuery } from "@/features/settings/services/queries";

export const Route = createFileRoute("/app/plans")({
	beforeLoad: async ({ context }) => {
		const [accounts, lateUpgradeGraceDaysDefault] = await Promise.all([
			context.queryClient.ensureQueryData(accountQueries.list({})),
			context.queryClient.ensureQueryData(lateUpgradeGraceDaysDefaultQuery()),
		]);
		return { accounts, lateUpgradeGraceDaysDefault };
	},
	component: RouteComponent,
	staticData: {
		breadcrumb: "Plans List",
	},
	errorComponent: ({ error }) => (
		<AlertErrorComponent message={error.message} />
	),
});

function RouteComponent() {
	return <Outlet />;
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/features/settings/services/settings.api.ts src/features/settings/services/queries.ts src/routes/app/plans/route.tsx
git commit -m "Add scoped late-upgrade grace-days default endpoint for the plans route"
```

---

### Task 10: Add the per-plan grace-period override field to `PlanForm`

**Files:**
- Modify: `src/features/plans/services/schemas.ts`
- Modify: `src/features/plans/components/plan-form.tsx`

**Interfaces:**
- Consumes: route context `lateUpgradeGraceDaysDefault: number` from Task 9.
- Produces: `PlanSchema.lateUpgradeGraceDays: number | null`. Consumed automatically by `upsertPlan` (unchanged — it spreads `...data`) and by `checkUpgradeEligibility` (Task 3) once a plan is saved with a value.

- [ ] **Step 1: Add the field to `planSchema`**

In `src/features/plans/services/schemas.ts`, add to the object passed to `z.object({...})` (order doesn't matter, place after `revenueAccountId`):

```ts
		revenueAccountId: z.string({ error: "Revenue account is required" }),
		lateUpgradeGraceDays: z
			.number()
			.int("Grace period must be a whole number of days")
			.min(0, "Grace period cannot be negative")
			.nullish(),
```

- [ ] **Step 2: Add the field to `PlanForm`**

In `src/features/plans/components/plan-form.tsx`, add `useRouteContext` selector for the default (the component already calls `useRouteContext({ from: "/app/plans", ... })` for `accounts`):

```ts
	const contextAccounts = useRouteContext({
		from: "/app/plans",
		select: (ctx) => ctx.accounts,
	});
	const lateUpgradeGraceDaysDefault = useRouteContext({
		from: "/app/plans",
		select: (ctx) => ctx.lateUpgradeGraceDaysDefault,
	});
```

Add to `defaultValues`:

```ts
const defaultValues = {
	name: "",
	memberCount: 1,
	description: "",
	isSessionBased: false,
	sessionCount: null,
	active: true,
	revenueAccountId: "",
	lateUpgradeGraceDays: null,
} as PlanSchema;
```

Add the field to the JSX, after the `revenueAccountId` field's `</form.AppField>` and before the `{plan && (...)}` active-checkbox block:

```tsx
					<form.AppField name="lateUpgradeGraceDays">
						{(field) => (
							<field.Input
								type="number"
								label="Late Upgrade Grace Period (days)"
								placeholder={`Default: ${lateUpgradeGraceDaysDefault}`}
								helperText={`Leave blank to use the default of ${lateUpgradeGraceDaysDefault} days.`}
								min={0}
								step={1}
							/>
						)}
					</form.AppField>
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/features/plans/services/schemas.ts src/features/plans/components/plan-form.tsx
git commit -m "Add per-plan late-upgrade grace period override field to PlanForm"
```

---

### Task 11: Add the global default field to Billing Settings

**Files:**
- Modify: `src/features/settings/services/schemas.ts`
- Modify: `src/features/settings/services/settings.api.ts:205-258` (`upsertBillingSettings`)
- Modify: `src/features/settings/components/billing-form.tsx`

**Interfaces:**
- Produces: `BillingSchema.lateUpgradeGraceDays: number | null`, persisted into `settings.billing.lateUpgradeGraceDays`. Consumed by Task 9's `getLateUpgradeGraceDaysDefault` and by `checkUpgradeEligibility` (Task 3) once saved.

- [ ] **Step 1: Add the field to `billingSchema`**

In `src/features/settings/services/schemas.ts`:

```ts
export const billingSchema = z.object({
	id: z.string().nullish(),
	invoicePrefix: z.string().nullish(),
	invoiceNumberPadding: z.number().nullish(),
	applyTaxToMembership: z.boolean().nullish(),
	vatType: z.enum(vatTypes).nullish(),
	vatAccountId: z.string().nullish(),
	autoCreateFinancialYear: z.boolean().nullish(),
	mpesaSettlementAccountId: z.coerce.number<number>().nullish(),
	memberCreditsPayableAccountId: z.coerce.number<number>().nullish(),
	creditForfeitureIncomeAccountId: z.coerce.number<number>().nullish(),
	creditNoteExpiryMonths: z.coerce
		.number<number>()
		.int({ error: "Credit note expiry must be a whole number of months" })
		.positive({ error: "Credit note expiry must be greater than zero" })
		.nullish(),
	lateUpgradeGraceDays: z.coerce
		.number<number>()
		.int({ error: "Grace period must be a whole number of days" })
		.min(0, { error: "Grace period cannot be negative" })
		.nullish(),
});
```

- [ ] **Step 2: Persist the field in `upsertBillingSettings`**

In `src/features/settings/services/settings.api.ts`, add `lateUpgradeGraceDays: data.lateUpgradeGraceDays ?? undefined,` to **both** the `.values({ billing: {...} })` block and the `.onConflictDoUpdate({ set: { billing: {...} } })` block (right after `creditNoteExpiryMonths: data.creditNoteExpiryMonths ?? undefined,` in each — there are two occurrences, one per block, lines 227 and 244 in the current file).

- [ ] **Step 3: Add the field to `BillingForm`**

In `src/features/settings/components/billing-form.tsx`, add to `defaultValues`:

```ts
			billingSettings ??
				({
					invoicePrefix: null,
					invoiceNumberPadding: null,
					applyTaxToMembership: false,
					vatType: null,
					vatAccountId: null,
					autoCreateFinancialYear: false,
					mpesaSettlementAccountId: null,
					memberCreditsPayableAccountId: null,
					creditForfeitureIncomeAccountId: null,
					creditNoteExpiryMonths: 12,
					lateUpgradeGraceDays: 3,
				} as BillingSchema),
```

Add the field inside the `<div className="col-span-full grid lg:grid-cols-3 gap-4">` block, alongside `creditNoteExpiryMonths`:

```tsx
					<form.AppField name="lateUpgradeGraceDays">
						{(field) => (
							<field.Input
								label="Late Upgrade Grace Period (Days)"
								placeholder="3"
								type="number"
								helperText="Default grace period (in days) after a membership expires during which a late upgrade can still be processed by an admin. Individual plans can override this."
							/>
						)}
					</form.AppField>
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/features/settings/services/schemas.ts src/features/settings/services/settings.api.ts src/features/settings/components/billing-form.tsx
git commit -m "Add global late-upgrade grace period default to Billing Settings"
```

---

### Task 12: Full verification pass

**Files:** none (verification only)

**Interfaces:** none.

- [ ] **Step 1: Full type-check**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 2: Full test suite**

Run: `npx vitest run`
Expected: all tests pass, including the new `resolveLateUpgradeGraceDays`/`computeDaysLate`/`evaluateLateUpgradeEligibility` suites from Task 2.

- [ ] **Step 3: Scoped Biome check on every file touched in this plan**

Run:
```bash
npx biome check src/drizzle/schemas/settings.ts src/drizzle/schemas/member.ts src/drizzle/schemas/membership-upgrades.ts src/lib/permissions/constants.ts src/features/receipts/lib/helpers.ts src/features/receipts/lib/helpers.test.ts src/features/receipts/lib/upgrade.ts src/features/receipts/services/schemas.ts src/features/receipts/services/payments.queries.api.ts src/features/receipts/services/payment.mutations.api.ts src/features/receipts/components/upgrade-payment-form.tsx src/features/receipts/components/payment-details.tsx src/features/settings/services/settings.api.ts src/features/settings/services/queries.ts src/routes/app/plans/route.tsx src/features/plans/services/schemas.ts src/features/plans/components/plan-form.tsx src/features/settings/services/schemas.ts src/features/settings/components/billing-form.tsx
```
Expected: 0 errors. Fix any formatting/lint issues it reports before proceeding.

- [ ] **Step 4: Manual QA in the browser**

First, grant `receipts:top-up-late` to the Admin role via the app's Roles & Permissions screen — see the delivery note in Task 1, Step 4; this isn't seeded automatically. Then, run: `pnpm dev`, and as a user holding both `receipts:top-up` and `receipts:top-up-late` (or an admin):

1. In Plans, edit a plan and set "Late Upgrade Grace Period (days)" to `2`. Save. Confirm it persists (reload the edit page, value is still `2`).
2. In Settings → Billing, confirm "Late Upgrade Grace Period (Days)" shows/saves correctly.
3. Find (or create, via direct DB edit or by waiting) a completed payment whose membership `endDate` is 1 day in the past, on the plan edited in step 1. On its receipt details page, confirm the "Upgrade" entry point is visible (not hidden).
4. Open the upgrade route for that payment. Confirm the late-upgrade warning banner appears with the correct `daysLate`/`graceDaysAllowed`, the "Reason for late upgrade" textarea is present and required, and the submit button is disabled until at least 10 characters are entered.
5. Submit the upgrade with a valid reason. Confirm it succeeds, navigates to the new receipt, and the activity log (Settings/Reports, wherever activity logs are visible) shows the "LATE UPGRADE" suffix with the reason.
6. Repeat with a membership more than `graceDaysAllowed` days expired — confirm the form renders the ineligible alert ("exceeding the grace period") instead of a form.
7. As a user who holds `receipts:top-up` but *not* `receipts:top-up-late`, repeat step 3 on an expired membership — confirm the "Upgrade" entry point stays hidden, and that navigating to the upgrade URL directly shows the ineligible alert ("requires admin approval"), never the form.
8. Test a membership terminated via a credit note — confirm it's ineligible with the terminated message, regardless of grace period or permission.

Expected: all eight scenarios behave as described. Note any deviation and fix before considering this plan complete.

- [ ] **Step 5: Final commit (if Step 3 required fixes)**

```bash
git add -A
git commit -m "Fix lint/format issues from late-upgrade grace period verification pass"
```
(Skip this step entirely if Step 3 found nothing to fix.)
