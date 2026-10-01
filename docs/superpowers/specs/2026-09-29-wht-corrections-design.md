# WHT Correction Entries — Design

## Purpose

Handle historical vendor bills that should have had withholding tax (WHT)
applied but didn't — without editing the original bill. The original bill
and its payment(s) are correct records of what actually happened at the
time (vendor genuinely invoiced and was paid gross); the compliance gap is
a separate, later fact and is recorded as its own transaction that
references the original bill(s) only for traceability.

The "no edit after payment" rule on bills is not lifted for this feature.
`bills` and `bill_items` are never written to by this feature, under any
circumstance.

## Two scenarios

1. **Already remitted** — the business already paid KRA the missed WHT
   amount out of its own funds, outside the app. Pure historical
   bookkeeping catch-up: record the cash outflow that already happened,
   dated as of when it happened. Never touches WHT Payable or the
   remittance workflow — it's already fully settled.
2. **Not yet remitted** — a missed-WHT discovery where the money hasn't
   gone to KRA yet. Flows into the *existing* WHT Payable + remittance
   workflow (`wht_remittances` / `wht_remittance_lines` /
   `vw_wht_balances`), so it gets remitted alongside ordinary bill-based
   WHT with no new remittance-side logic.

One correction entry can reference multiple bills (a backlog), the same
shape as a bill payment or a remittance spanning multiple bills/lines.

## Schema

New migration (next sequential number after `0095_rainy_stepford_cuckoos.sql`).

### `wht_correction_status` enum
`already_remitted` | `pending`

### `wht_corrections` (header)

| column | type | notes |
|---|---|---|
| `id` | pk | same convention as `wht_remittances.id` |
| `correction_no` | integer | sequential, human-readable identifier (mirrors `remittance_no`) |
| `correction_date` | date | |
| `treatment_account_id` | int FK `ledger_accounts` | user-selected debit account; must be an active posting **expense or asset** account — reuse `findInvalidPostingAccountIdsByType(accounts, ids, ["expense","asset"])` (`src/features/coa/services/account-option-filter.ts`), the same validator `bills.api.ts` uses. No new ledger account is created by this feature (user picks from existing COA). |
| `remittance_status` | `wht_correction_status` | |
| `remittance_date` | date, nullable | required when `already_remitted` |
| `payment_method` | enum `cash`/`mpesa`/`bank`/`cheque`, nullable | required when `already_remitted`; same enum/UX as `wht-remittances` and `payments` |
| `bank_id` | FK `bank_accounts`, nullable | required when `payment_method` is `bank`/`cheque` |
| `cash_equivalent_account_id` | int FK `ledger_accounts`, nullable | required when `payment_method` is `cash`/`mpesa` |
| `crediting_account_id` | int FK `ledger_accounts` | resolved and stored at post time (same as `wht_remittances.crediting_account_id`) |
| `memo` | text, nullable | |
| `created_by`, `created_at`, `updated_at` | | |

### `wht_correction_lines`

| column | type | notes |
|---|---|---|
| `id` | serial | |
| `line_number` | integer | |
| `correction_id` | FK `wht_corrections`, cascade delete | |
| `bill_id` | FK `bills` | reference only, for traceability — never used to modify the bill |
| `wht_category` | `wht_category_enum` | reuse existing enum from `bill.ts` |
| `wht_rate` | numeric(5,2) | informational only — what rate should have applied; not used in posting |
| `amount` | numeric(10,2) | |

No `update` capability: corrections are create-or-delete only. To fix a
mistake, delete and recreate — consistent with treating a posted
correction as an immutable ledger entry (delete cleans up its journal
entry, banking entry, and lines via cascade/`source`+`sourceId`, the same
way `deleteRemittance` does).

## Posting logic

Both scenarios post within a `db.transaction`, tagged
`source: "wht_corrections", sourceId: correction.id` for journal/banking
cleanup on delete, followed by `logActivity` after commit. Returns
`success(...)`/`failure(...)` from `@/lib/result`.

### `already_remitted`

1. Resolve `creditingAccountId` from `paymentMethod` / `bankId` /
   `cashEquivalentAccountId` — same branching logic
   `getCashEquivalentAccountId` (`src/services/journal.ts`) already
   implements for `wht-remittances`.
2. `createJournalEntry`: DR `treatment_account_id`, CR
   `crediting_account_id`, both = `sum(lines.amount)`, dated
   `remittance_date` (the actual historical date the money left — not
   today's date).
3. `createBankingEntry` additionally, only when `payment_method` is
   `bank`/`cheque` (i.e. `bank_id` present) — same condition
   `wht-remittances.api.ts` uses for its own banking entry.
4. Never touches `wht_payable` or `wht_remittance_lines`. Never appears in
   the WHT remittance workflow — it's already fully settled.

### `pending`

1. `createJournalEntry`: DR `treatment_account_id`, CR `wht_payable`
   (resolved via `resolveAccountRole("wht_payable")`,
   `src/services/ledger-account-mappings.ts` — the same role-resolution
   helper `bills.api.ts` and `wht-remittances.api.ts` already use; no new
   role needed), both = `sum(lines.amount)`, dated `correction_date` (no
   remittance date exists yet).
2. No banking entry.
3. Feeds `vw_wht_balances` (see below) so the amount becomes selectable in
   the existing WHT remittance screen with no remittance-side code
   changes.

**No row-locking.** `wht-remittances`' `createRemittance` locks affected
bills (`SELECT ... FOR UPDATE`) because a remittance *consumes* a bounded
`wht_balance` and two concurrent remittances could over-claim it. A
correction is purely additive — it either increases the KRA-owed
liability or records cash that already left — so there is no shared,
decrementable balance at risk of a concurrent over-claim.

## View changes

Both views require `DROP VIEW ... CASCADE` + recreate (column sets
change), following the precedent set in `0093_wht_balance_views.sql`.
Before using `CASCADE`, confirm during implementation that no other view
depends on `vw_invoices` or `vw_wht_balances` (none currently known, but
verify against the live schema). The `pgView(...).existing()` stubs for
both views in `src/drizzle/schemas/bill.ts` must be updated to match the
new column sets.

### `vw_wht_balances`

`wht_amount` keeps its current meaning (`bills.wht_amount`, unchanged) so
existing consumers (e.g. `bills.api.ts`'s `getBills` join) aren't affected.
A new `pending_correction_amount` column is added, and folded into
`wht_balance`:

```sql
CREATE VIEW vw_wht_balances AS
SELECT
    b.id, b.invoice_date, b.invoice_no, b.vendor_id, v.name, v.tax_pin,
    b.total, b.wht_amount,
    COALESCE(pc.amount, 0) AS pending_correction_amount,
    COALESCE(sum(wrl.amount), 0) AS remitted_amount,
    (b.wht_amount + COALESCE(pc.amount, 0)) - COALESCE(sum(wrl.amount), 0) AS wht_balance,
    b.wht_certificate_no, b.wht_certificate_issued_date
FROM bills b
    JOIN vendors v ON b.vendor_id::text = v.id::text
    LEFT JOIN wht_remittance_lines wrl ON wrl.bill_id::text = b.id::text AND wrl.dc = 'credit'::line_dc
    LEFT JOIN (
        SELECT wcl.bill_id, sum(wcl.amount) AS amount
        FROM wht_correction_lines wcl
        JOIN wht_corrections wc ON wc.id = wcl.correction_id
        WHERE wc.remittance_status = 'pending'
        GROUP BY wcl.bill_id
    ) pc ON pc.bill_id::text = b.id::text
WHERE (b.wht_amount > 0 OR pc.amount > 0)
    AND b.status <> ALL (ARRAY['draft'::bill_status, 'cancelled'::bill_status])
GROUP BY b.id, b.invoice_date, b.invoice_no, b.vendor_id, v.name, v.tax_pin, b.total, b.wht_amount, pc.amount, b.wht_certificate_no, b.wht_certificate_issued_date
ORDER BY b.invoice_date DESC, b.invoice_no DESC;
```

`WHERE` clause change: previously only bills with `wht_amount > 0`
appeared. Now a bill with **zero** original WHT but a pending correction
(the "missed WHT entirely" case) also surfaces, since otherwise it could
never be remitted. This is a required behavior change, not incidental.

### `vw_invoices`

Subtracts correction-line amounts **regardless of `remittance_status`** —
whether the WHT was already remitted to KRA or is still pending is
irrelevant to what the vendor was owed; either way the vendor was never
entitled to that amount. Only the remittance workflow and
`vw_wht_balances` care about `remittance_status`; the vendor-facing
balance does not.

```sql
CREATE VIEW vw_invoices AS
SELECT
    b.id, b.invoice_date, b.due_date, b.vendor_id, b.invoice_no, v.name,
    b.total, b.wht_amount,
    b.total - COALESCE(b.wht_amount, 0) - COALESCE(wc.amount, 0) AS net_payable,
    COALESCE(sum(bpl.amount), 0) AS total_payment,
    (b.total - COALESCE(b.wht_amount, 0) - COALESCE(wc.amount, 0)) - COALESCE(sum(bpl.amount), 0) AS balance,
    b.status,
    (
        b.due_date IS NOT NULL AND b.due_date < CURRENT_DATE
        AND (b.total - COALESCE(b.wht_amount, 0) - COALESCE(wc.amount, 0)) - COALESCE(sum(bpl.amount), 0) > 0
        AND b.status <> ALL (ARRAY['draft'::bill_status, 'cancelled'::bill_status])
    ) AS is_overdue,
    (b.status <> ALL (ARRAY['draft'::bill_status, 'cancelled'::bill_status])) AS is_payable,
    CASE
        WHEN b.status = ANY (ARRAY['draft'::bill_status, 'cancelled'::bill_status]) THEN b.status
        WHEN (b.total - COALESCE(b.wht_amount, 0) - COALESCE(wc.amount, 0)) - COALESCE(sum(bpl.amount), 0) <= 0 THEN 'paid'::bill_status
        WHEN b.due_date IS NOT NULL AND b.due_date < CURRENT_DATE THEN 'overdue'::bill_status
        WHEN COALESCE(sum(bpl.amount), 0) > 0 THEN 'partially-paid'::bill_status
        ELSE b.status
    END AS display_status
FROM bills b
    JOIN vendors v ON b.vendor_id::text = v.id::text
    LEFT JOIN bill_payment_lines bpl ON bpl.bill_id::text = b.id::text AND bpl.dc = 'credit'::line_dc
    LEFT JOIN (
        SELECT bill_id, sum(amount) AS amount FROM wht_correction_lines GROUP BY bill_id
    ) wc ON wc.bill_id::text = b.id::text
GROUP BY b.id, b.invoice_date, b.due_date, b.invoice_no, v.name, b.total, b.wht_amount, wc.amount
ORDER BY b.invoice_date DESC, b.invoice_no DESC;
```

`balance`, `is_overdue`, and `display_status` all derive from
`net_payable`, so once `net_payable` accounts for corrections, all three
become correct automatically. Example: a bill totaled 14,000, 13,900 was
ever actually payable once WHT is accounted for, and 13,900 was paid in
full. Before a correction exists, `vw_invoices` shows `total_payment =
13,900` against `total = 14,000`, a phantom 100 balance, and the bill
reads perpetually overdue. After a correction of 100:
`net_payable = 14,000 - 0 - 100 = 13,900`; `balance = 13,900 - 13,900 =
0` → correctly shows as paid. Creating a correction entry therefore has
an immediate, visible effect on the bill list/overdue stats the moment
it's saved — intended behavior, not a side effect to suppress.

## Validation

- At least one line required.
- `remittance_date` and (`bank_id` or `cash_equivalent_account_id`, per
  `payment_method`) required only when `remittance_status =
  'already_remitted'`. Mirrors the conditional `superRefine` pattern in
  `src/features/wht-remittances/services/schemas.ts`.
- `treatment_account_id` must be an active posting expense or asset
  account — validated via `findInvalidPostingAccountIdsByType`, no new
  validator.
- Each `bill_id` referenced must exist.
- Soft warning (not a hard block) when a bill already has an existing
  correction line referencing it, surfaced via a new query (e.g.
  `correctionQueries.existingCorrectionsForBills(billIds)`) the form
  calls when bills are picked — a banner, not a validation error.

## Reporting — WHT Schedule extension

`src/features/reports/services/wht-schedule.api.ts` currently queries
`bill_items` only, filtered by `invoice_date` in the requested range. Add
a second query pulling `wht_correction_lines` joined to `wht_corrections`
+ the referenced `bills`/`vendors`, filtered by **`correction_date`** in
the requested range (a correction is filed in the period it was actually
recorded, not retroactively into the original bill's period).

Merge both result sets in `wht-schedule.ts`, tagging each row:
- `rowType: "billing" | "correction"`
- `remittanceStatus: null | "already_remitted" | "pending"` (`null` for
  `"billing"` rows)

Reuse `summariseWhtSchedule`'s existing rate-bucketing unchanged — it's
already source-agnostic. Correction rows: `whtAmount = line.amount`,
`rate = line.wht_rate`, `grossAmount = null` (corrections don't carry a
VAT-exclusive base the way bill lines do; the report UI renders a dash
rather than inventing a number).

## Permissions

Add to `PERMISSIONS` (`src/lib/permissions/constants.ts`), directly after
the `wht-remittances:*` block:
- `wht-corrections:view`
- `wht-corrections:create`
- `wht-corrections:delete`

Descriptions auto-derive via `buildPermissionDescription` — no manual
label work needed. Add a nav entry in `src/lib/constants.ts` near "WHT
Remittances", gated on `wht-corrections:view`.

## Routes

Mirrors `wht-remittances`' route tree:
- `/app/wht-corrections` — list (permission `wht-corrections:view`)
- `/app/wht-corrections/new` — create form (permission
  `wht-corrections:create`)
- `/app/wht-corrections/$correctionId/details` — read-only detail
  (permission `wht-corrections:view`)

No `/edit` route — matches the no-update decision.

The bill picker's exact component (search-as-you-type across vendors, or
a vendor-then-bill two-step picker) is an implementation-planning detail,
not a design-level decision — the plan should identify the closest
existing reusable picker before building a new one, per the "prefer
existing UI components" project convention.

## Testing

Targeted Vitest coverage, following existing style
(`wht-schedule.test.ts`, `bill-totals.test.ts`):
- New Zod schema: conditional-required-field cases (`already_remitted`
  vs `pending`, each `payment_method` branch).
- Posting-amount math: `sum(lines.amount)` used consistently for both
  DR and CR sides (balanced-journal invariant, mirroring
  `areJournalValuesBalanced` usage elsewhere).
- Report merge/grouping logic extended to correction rows (rate bucketing
  works across mixed `rowType`s; `grossAmount` totals correctly exclude
  `null`s).

## What this feature never does

- Writes to `bills` or `bill_items`.
- Lifts the bill edit-lock rule.
- Touches `vw_invoices`' `is_payable` logic (unrelated to WHT).
- Creates a new ledger account (all `treatment_account_id` selections
  come from the existing chart of accounts).
- Adds an update/edit capability for corrections.
