# Late Upgrade Grace Period

## Goal

Extend the existing Upgrade/Top-up feature so that a payment whose membership has already expired can still be upgraded within a configurable, per-plan grace period, by a user holding a new permission, with a mandatory logged reason. Today `checkUpgradeEligibility` unconditionally rejects any payment whose membership `endDate` has passed — there is no path to correct a late upgrade after the fact.

This is a bounded exception layered onto the existing eligibility check, server function, and form — not a parallel feature.

## Current Behavior (for reference)

- `checkUpgradeEligibility` (`src/features/receipts/lib/upgrade.ts`) computes `endDate < today` directly rather than trusting `memberMemberships.status`, because `runMembershipMaintenance` (`membership-payment-finalizer.ts`) only flips `active → expired` when that job next runs — the stored status can lag the real date.
- `upgradePaymentFn` (`payment.mutations.api.ts:633-913`) re-runs the same eligibility check inside its transaction (authoritative), computes `newEndDate` via `computeMembershipEndDate`, mutates the existing `memberMemberships` row(s) in place, and inserts one `membershipUpgrades` audit row.
- `payment-details.tsx` hides the "Upgrade" entry point entirely once `endDate < today`, for every user regardless of permission.
- Membership termination (e.g. via a credit note, `credit-note.mutations.api.ts:139`) sets `memberMemberships.status = "terminated"` directly — this is not date-derived and already excluded from the normal upgrade path via `checkVoidEligibility`'s sibling logic, but `checkUpgradeEligibility` itself has no explicit terminated check today (a terminated row's `endDate` may still be in the future).

## Reconciling task spec vs. existing convention

The task spec describes branching eligibility on `memberMemberships.status` (`active`/`expired`/`terminated`). The codebase deliberately avoids trusting `status` for the active/expired boundary (see above). Reconciliation, confirmed with the user:

- **Active vs. expired**: keep the existing computed `endDate < today` check, unchanged. Do not switch to trusting `status` for this boundary.
- **Terminated**: check `status === "terminated"` explicitly — this is the only reliable signal for termination, since it isn't date-derivable. Add this as a new, additive check (immediate ineligibility, independent of the late-upgrade path).

## Decisions (from task.md, confirmed)

- Three new nullable columns on `membership_upgrades`: `isLateUpgrade` (boolean, not null, default false), `daysAfterExpiry` (integer, nullable), `lateUpgradeReason` (text, nullable). No separate table.
- New permission `receipts:top-up-late`. Gate on the permission everywhere; never check a literal role name.
- Grace period resolves as `originalPlan.lateUpgradeGraceDays ?? settings.billing.lateUpgradeGraceDays ?? 3` — always the plan the member was already on, never the plan being upgraded to. Absolute day count, not a percentage of plan duration.
- Only `status: "expired"` memberships are eligible for the late path. `status: "terminated"` is never eligible.
- If the recomputed `newEndDate` still falls before today even after a late upgrade, warn but don't block — informational only.
- Server-side validation is authoritative regardless of client state.

## Schema

**`src/drizzle/schemas/settings.ts`** — add to the `billing` jsonb type:
```ts
lateUpgradeGraceDays?: number;
```
Global fallback default (e.g. `3`) lives in the settings form's `defaultValues` and in the eligibility helper's final `?? 3`, matching how `creditNoteExpiryMonths` already works — jsonb fields have no DB-level default.

**`src/drizzle/schemas/member.ts`**, `membershipPlans` table — add:
```ts
lateUpgradeGraceDays: integer("late_upgrade_grace_days"), // nullable; null = use the global default
```

**`src/drizzle/schemas/membership-upgrades.ts`**, `membershipUpgrades` table — add:
```ts
isLateUpgrade: boolean("is_late_upgrade").notNull().default(false),
daysAfterExpiry: integer("days_after_expiry"),
lateUpgradeReason: text("late_upgrade_reason"),
```

Generate the migration via `drizzle-kit generate`. Do not run/apply it, per existing project convention.

## Permission

Add `"receipts:top-up-late"` to `PERMISSIONS` in `src/lib/permissions/constants.ts`, grouped with the other `receipts:*` entries.

`role_permissions` is populated at runtime through the app's Roles screen (`src/features/users/services/roles.api.ts`), not through seed data — there is no seed-time role-to-permission assignment anywhere in this codebase to extend. This will be called out explicitly at delivery: the Admin role needs `receipts:top-up-late` granted manually via the app after this ships.

## Eligibility Helper (`checkUpgradeEligibility`)

New signature: `checkUpgradeEligibility(dbOrTx, paymentId, hasLateUpgradePermission: boolean)`. The permission check itself stays out of the helper — callers compute the boolean via `userHasPermission(userId, role, "receipts:top-up-late")` and pass it in, keeping the helper's responsibility limited to eligibility logic (consistent with permission checks living at server-fn boundaries elsewhere in this codebase).

After the existing "not found / not completed / no linked plan" checks and after fetching `plan` (the member's *current*/original plan — the variable is effectively `originalPlan`, kept explicit in comments) and `membershipRow` (now also selecting `status`):

1. `isTerminated = membershipRow.status === "terminated"` → immediate failure: "This membership was terminated and cannot be upgraded."
2. `isExpired = membershipRow.endDate !== null && membershipRow.endDate < today` (unchanged computation).
   - Not expired → existing behavior, unchanged. Returned data includes `isLate: false, daysLate: null, graceDaysAllowed: null`.
   - Expired:
     - Fetch `settings.billing.lateUpgradeGraceDays` (via `dbOrTx.query.settings.findFirst`).
     - `graceDaysAllowed = plan.lateUpgradeGraceDays ?? settings?.billing?.lateUpgradeGraceDays ?? 3` — `plan` here is the *original* plan; never read this field off the new/target plan.
     - `daysLate = differenceInCalendarDays(parseCalendarDate(today), parseCalendarDate(membershipRow.endDate))`.
     - `daysLate > graceDaysAllowed` → failure: "This membership expired N days ago, exceeding the M-day grace period — the member must renew instead."
     - `!hasLateUpgradePermission` → failure: "This membership expired N days ago and requires admin approval to upgrade." (distinct message from the grace-exceeded case)
     - Otherwise → proceed with `isLate: true, daysLate, graceDaysAllowed` carried into the returned data.
3. Existing "already renewed" / "already upgraded" checks run unchanged, after the above.

`UpgradeEligibility` type gains `isLate: boolean`, `daysLate: number | null`, `graceDaysAllowed: number | null`.

## Server Function (`upgradePaymentFn`)

1. Before calling `checkUpgradeEligibility`, compute `hasLateUpgradePermission = await userHasPermission(userId, context.user.role, "receipts:top-up-late")`.
2. Pass it into `checkUpgradeEligibility`.
3. `upgradePaymentSchema` gains an optional `lateUpgradeReason` field. A `superRefine` requires it (min length, matching `voidPaymentSchema`'s `voidReason` convention — trimmed, minimum 10 characters) whenever the request is for a late upgrade. Since the schema itself can't know eligibility, the server handler performs this check explicitly after the eligibility result comes back (`if (eligibility.data.isLate && !lateUpgradeReason?.trim()) throw fail(...)`), rather than relying solely on the Zod schema — mirrors how other cross-field business rules in this handler are enforced (e.g. the member-count match), not schema-level validation alone.
4. `newEndDate` computed exactly as today, no formula change.
5. If `newEndDate < today`, the success return value includes an additional `warning: string` field — this does not become a failure.
6. `membershipUpgrades` insert gains:
   ```ts
   isLateUpgrade: eligibility.data.isLate,
   daysAfterExpiry: eligibility.data.isLate ? eligibility.data.daysLate : null,
   lateUpgradeReason: eligibility.data.isLate ? lateUpgradeReason : null,
   ```
7. Activity log description gains a suffix when late: appends ` LATE UPGRADE (${daysLate} days after expiry). Reason: ${lateUpgradeReason}.`

`getUpgradeContext` (the loader query and source of truth for the "Upgrade" entry point) gets the same `hasLateUpgradePermission` plumbing and returns `isLate`, `daysLate`, `graceDaysAllowed` in its `eligible: true` payload, so the form never re-derives them.

## Route + Form (`/app/receipts/$receiptId/upgrade`)

- `upgrade.tsx`: no `beforeLoad` change — `receipts:top-up` still gates route entry. The late-specific gate is entirely inside `getUpgradeContext`'s eligibility result, which the form already renders as a blocking alert for any ineligible reason (unchanged code path, new reason strings). This satisfies "don't render the form at all, show a message" for users without `receipts:top-up-late` without new branching.
- `upgrade-payment-form.tsx`, when `upgradeContext.eligible && upgradeContext.isLate`:
  - A non-blocking banner above the form: membership expired `daysLate` days ago (grace period: `graceDaysAllowed` days); proceeding will be logged as a late upgrade.
  - A required "Reason for late upgrade" textarea, rendered only in this branch. Added to the client-side `upgradePaymentSchema` validation the same way the server enforces it.
  - Submit stays disabled until the reason is non-empty when late (UX convenience only — Step 4's server check is authoritative).
  - The existing client-side `newEndDate` preview (via `computeMembershipEndDate`) gets a second non-blocking warning banner near `<PaymentSummary />` if it falls before today.

## `payment-details.tsx` Button Gate

```ts
const isMembershipStillActive = !payment.membership?.endDate || payment.membership.endDate >= today;
const canParticipateInUpgrade =
  payment.status === "completed" &&
  !!payment.planId &&
  (isMembershipStillActive || hasPermission("receipts:top-up-late"));
```
The existing `upgradeContext` query (gated behind `hasPermission("receipts:top-up")`) remains the actual source of truth for whether the grace period/permission combination makes the payment eligible — this change only stops hard-blocking that round trip before it can run for admins.

## Plan Form + Billing Settings UI

- `plan-form.tsx` / `planSchema`: new optional nullable numeric field `lateUpgradeGraceDays`. Helper text interpolates the current global default (passed down via the existing route-context/loader mechanism, same place `revenueAccountId`'s account list already comes from), e.g. "Leave blank to use the default of 3 days."
- `billing-form.tsx` / `billingSchema`: new numeric field `lateUpgradeGraceDays`, default `3`, following the same pattern as the existing `creditNoteExpiryMonths` field.

## Testing

- Unit tests for the eligibility helper's new branches: active (unchanged), expired-within-grace-with-permission (success, `isLate: true`), expired-within-grace-without-permission (failure), expired-beyond-grace (failure, regardless of permission), terminated (failure), plan-level override vs. global fallback resolution.
- Unit test for the grace-days resolution order: `plan.lateUpgradeGraceDays ?? settings.billing.lateUpgradeGraceDays ?? 3`, confirming it always reads the *original* plan and never the new/target plan.
- Run `pnpm typecheck` (or `tsc --noEmit`), targeted Vitest coverage for the touched files, and `pnpm check` (Biome) scoped to changed files.
