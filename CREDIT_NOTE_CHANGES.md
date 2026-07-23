# Credit Note Feature — What Changed & How to Test It

This document explains every file touched by the Credit Note feature (migration files are skipped — those are just the SQL Drizzle generated from the schema files, nothing hand-written) and then walks through testing the whole flow in the browser, step by step.

---

## Part 1 — File-by-file explanation

### A. Database schema

**`src/drizzle/schemas/credit-notes.ts`** *(new file)*
Defines the two new database tables:
- `credit_notes` — one row per issued credit note: which member, which membership/payment it came from, the amount, how much balance is left, its status (`active` / `partially_redeemed` / `fully_redeemed` / `expired`), and when it expires.
- `credit_note_redemptions` — one row every time a credit note's balance is spent against a future payment. Has a database-level rule enforcing that each row is linked to *either* a membership payment *or* an addon invoice, never both, never neither.

**`src/drizzle/schema.ts`**
One-line addition registering the new `credit-notes.ts` file so the rest of the app (and Drizzle's query builder) knows these tables exist.

**`src/drizzle/schemas/settings.ts`**
Added three new fields to the existing `billing` settings block: `memberCreditsPayableAccountId`, `creditForfeitureIncomeAccountId`, and `creditNoteExpiryMonths`. This is stored as JSON in the database, so this change alone needed no migration — the migration only had to create the two new tables above.

### B. Settings — schema validation, save logic, and the settings screen

You specifically asked about these — here's what changed and why, in order:

**`src/features/settings/services/schemas.ts`**
Added validation rules for the three new settings fields to the existing `billingSchema`. `creditNoteExpiryMonths` must be a positive whole number (this was tightened after code review — originally it allowed negative or fractional values, which would have produced nonsense expiry dates).

**`src/features/settings/services/settings.api.ts`**
The function that actually saves settings to the database (`upsertBillingSettings`) now includes the three new fields when it writes the `billing` block — otherwise your new settings would validate fine on the form but silently never get saved.

**`src/features/settings/components/billing-form.tsx`**
Added three new fields to the "Financial" settings tab:
- A dropdown to pick the **Member Credits Payable Account** (a liability account).
- A dropdown to pick the **Credit Forfeiture Income Account** (a revenue account).
- A number field for **Credit Note Expiry (Months)**, defaulting to 12.

**`src/routes/app/settings.tsx`** *(fixed just now, see note below)*
The settings page loads three lists of ledger accounts for the dropdowns above: liability accounts, asset accounts, and — newly added — revenue accounts. **Note:** when I first built this, I mistakenly wired the Credit Forfeiture Income Account dropdown to the *liability* accounts list (copy-paste from the payable-account field next to it), which would have meant your income accounts never showed up in that dropdown. I caught this while preparing this document and fixed it — the route now loads a separate revenue-accounts list, and the form uses it correctly. This is already fixed in your working copy.

### C. Permissions & navigation

**`src/lib/permissions/constants.ts`**
Added two new permission strings: `credit-notes:view` and `credit-notes:create`. These are independent of the existing `receipts:*` permissions, per your earlier instruction.

**`src/lib/constants.ts`**
Added "Credit Notes" as its own item in the Finance section of the sidebar menu, right under "Receipts", linking to `/app/credit-notes` and gated by `credit-notes:view`.

### D. The new Credit Notes feature module (`src/features/credit-notes/`)

This is all-new code, organized the same way the existing Receipts feature is:

- **`lib/eligibility.ts`** — Given a membership, works out whether it can be credited (not already terminated, has days left, hasn't already been credited, its payment is completed), and calculates the suggested credit amount (daily rate × unused days, capped at what was actually paid) and how much of that should be VAT vs. plain revenue.
- **`lib/fifo.ts`** — When a member redeems credit against a new payment, this decides which of their credit notes to draw from — soonest-expiring first, split across multiple credit notes if needed.
- **`lib/redemption.ts`** — Actually applies a redemption (writes the redemption record, reduces the credit note's balance), and the reverse: restores a credit note's balance if the payment that redeemed it gets voided.
- **`lib/numbering.ts`** — Generates the next sequential credit note number.
- **`lib/*.test.ts`** — Automated tests for the math above (all passing).
- **`services/schemas.ts`** — Form validation rules for issuing a credit note and for searching the credit notes list.
- **`services/credit-note.mutations.api.ts`** — The server-side action that actually issues a credit note: terminates the membership, posts the accounting journal entry, and records the credit note.
- **`services/credit-note.queries.api.ts`** and **`services/queries.ts`** — Server-side functions for fetching a member's credit balance, listing credit notes, and viewing one credit note's details.
- **`services/credit-note.maintenance.ts`** — The daily job that writes off (expires) any credit note balance that's gone unused past its expiry date.
- **`hooks/use-issue-credit-note.ts`** — Small React hook wiring the issuance form to the server action.
- **`components/issue-credit-note-form.tsx`** — The "Issue Credit Note" form UI.
- **`components/credit-notes-table.tsx`** — The list/table of all credit notes.
- **`components/credit-note-details.tsx`** — The single credit note detail page, including its redemption history.

### E. New pages (`src/routes/app/credit-notes/`)

Four route files wiring the components above into actual URLs:
- `/app/credit-notes` — the list page
- `/app/credit-notes/new` — the issue form
- `/app/credit-notes/$creditNoteId/details` — a single credit note's detail page
- `route.tsx` — shared layout wrapper for the three above

### F. Shared member-access helper

**`src/services/member-access.ts`** *(new file)*
If crediting a membership leaves a member with *no other* active membership, this switches off their portal login and physical gym access — the same thing that already happens when a membership naturally expires. This logic previously only lived inside the daily expiry job; it's now shared so credit note issuance triggers it too (added after code review flagged that terminating a membership via credit note was leaving access enabled indefinitely).

### G. Changes to the existing Receipts feature

These let a payment be partly or fully paid using a member's credit balance, instead of cash:

- **`src/features/receipts/lib/journal.ts`** — The function that builds accounting journal entries for a receipt now supports an optional "credit applied" line, and can leave out the bank/cash line entirely if credit covers the whole payment.
- **`src/features/receipts/services/membership-payment-finalizer.ts`** — Where a membership payment is finalized: now accepts an amount of credit to apply, checks it against the member's actual balance, and adjusts the accounting entries and bank posting accordingly.
- **`src/features/receipts/services/payment.mutations.api.ts`** — Same credit-application support added to the "addon only" payment path, plus (in the Void flow) the logic that blocks voiding a payment that funded a credit note, and restores a credit note's balance if a payment that redeemed it gets voided.
- **`src/features/receipts/services/schemas.ts`** — Added the `appliedCreditAmount` field to the payment forms' validation rules.
- **`src/features/receipts/lib/void.ts`** — Added the check that stops staff from voiding a payment that already funded a credit note.
- **`src/features/receipts/components/payments-form.tsx`** — The "New Receipt" form: once you pick a member, it now fetches their available credit balance and shows an "Apply Credit" field if they have any.
- **`src/features/receipts/components/payment-summary.tsx`** — The price summary panel now shows "Credit applied" as a deduction, with "Amount Due" reflecting what's actually left to pay in cash.
- **`src/features/receipts/lib/journal.test.ts`** *(new)* — Automated tests confirming the journal-building changes above didn't break the existing behavior.

### H. Maintenance job wiring

**`src/routes/api/cron/daily/index.ts`**
Added a call to the new credit-note expiry write-off job, alongside the other daily maintenance tasks that already run there (membership expiry, inactive-member deactivation, etc.).

### Not covered above

- **`src/routeTree.gen.ts`** — Auto-generated by the framework whenever route files change. No manual edits; nothing to review here.
- **Migration files** (`src/drizzle/migrations/0087_...`, `meta/_journal.json`, `meta/0087_snapshot.json`) — Skipped per your request.

---

## Part 2 — Step-by-step browser test

Do these **in order** — each step depends on the one before it.

### 0. Apply the database migration

The migration was generated but deliberately never run. Before anything below will work:

```bash
npm run db:migrate
```

### 1. Make sure the two new permissions exist in the database

`credit-notes:view` and `credit-notes:create` were added to the code, but your `permissions` table needs matching rows before you can assign them to a role.

- Open Drizzle Studio: `npm run db:studio`, go to the `permissions` table, and check whether rows with `key = credit-notes:view` and `key = credit-notes:create` exist.
- If they're missing, the safe way to add just these two (without touching your other data) is to add two rows manually in Studio:
  | resource | action | key | description |
  |---|---|---|---|
  | credit-notes | view | credit-notes:view | Allow users to view credit notes. |
  | credit-notes | create | credit-notes:create | Allow users to create credit notes. |
- (Alternative: `npm run db:seed` also does this, but it re-seeds *everything* — demo members, users, attendance, etc. — so only use it if you're fine with that on this database.)

### 2. Create the two new ledger accounts

Go to **Chart of Accounts** (`/app/chart-of-accounts`) → **New Account**. Both accounts must be marked as **posting accounts** — only posting accounts show up in the Settings dropdown you'll use in the next step.

**Member Credits Payable (liability)**
- Parent: **Current Liabilities** (code `2300`) — your general-purpose liability bucket (it already holds "Loan Payable"). A member's credit balance is a genuine current liability: you owe it to them, expected to be settled (redeemed or written off) within the 12-month expiry window. It doesn't fit under "Payables And Accruals" (vendor payables), "Payroll Liabilities", or "Tax Payables" (VAT Output lives there, but this isn't a tax).
- Suggested code: `2302`

**Credit Forfeiture Income (revenue)**
- There's no ideal existing parent for this one. Everything under Revenue currently sits under "Service Revenue" (`4000`) — Gym Membership, Beverages & Drinks, Locker Revenue — which is all *operating* revenue from delivering a service. Forfeiture income is different in kind: it's incidental/non-operating income (a member simply not using something they paid for), not revenue from service delivery. Two options:
  1. **Cleaner (recommended):** create a new non-posting header account **"Other Income"** (code `4100`), then create "Credit Forfeiture Income" as a posting account under it (code `4101`). Keeps your Service Revenue subtotal meaning what it says on reports.
  2. **Simpler:** park "Credit Forfeiture Income" directly under "Service Revenue" (`4000`) as a posting account (e.g. code `4004`). Works functionally, just mixes non-operating income into your operating revenue subtotal — fine to do now and reclassify later.

These must exist before you can select them in the next step — the feature doesn't create them for you.

### 3. Configure the new Billing settings

Go to **Settings** (`/app/settings`) → **Financial** tab. Fill in:
- **Member Credits Payable Account** → the liability account you just created
- **Credit Forfeiture Income Account** → the revenue account you just created
- **Credit Note Expiry (Months)** → leave at 12, or set whatever you want

Save.

### 4. Grant yourself the credit-notes permissions

Go to **User Management → Roles** (`/app/users/roles`), edit the role your test user has, and tick both **credit-notes:view** and **credit-notes:create**. Save.

You should now see **Credit Notes** appear under **Finance** in the sidebar.

### 5. Set up a member + membership to credit

You need a member with:
- An **active** membership
- An **end date in the future** (the further out, the bigger the "unused days" credit will be)
- A payment behind it with status **completed**

Easiest: go to **Receipts → New Receipt**, create a fresh membership payment for a test member (pick a plan with a long duration so there's plenty of unused time), and complete it.

### 6. Issue the credit note

Go to **Credit Notes → Issue Credit Note** (`/app/credit-notes/new`):
1. Select the member.
2. Select their membership from the dropdown that appears.
3. You should see the suggested amount, daily rate, and unused days appear automatically.
4. Optionally edit the amount (it's capped at what was originally charged).
5. Enter a reason (at least 5 characters).
6. Submit.

You should land on the new credit note's detail page.

### 7. Verify it worked

- Go back to the member's membership — it should now show as **terminated**.
- On the credit note detail page, confirm the amount, balance remaining, and expiry date look right.
- Go to **Journal Entries** (`/app/journal-entries`, under Finance in the sidebar) and confirm a new entry exists (source "credit note issuance"): debiting the plan's revenue account (and VAT account, if the original payment had tax), crediting your Member Credits Payable account.

### 8. Redeem the credit on a new payment

Go to **Receipts → New Receipt** again, and select the **same member** as the billing member (first person selected) for a new membership or addon payment:
1. Once selected, an **"Apply Credit"** field should appear, showing their available balance.
2. Enter an amount to apply (up to the lesser of their balance or the payment total).
3. Confirm the **Payment Summary** panel shows "Credit applied" as a deduction and a reduced "Amount Due".
4. Submit the payment.

### 9. Verify the redemption

- On the new receipt's journal entry, confirm the bank/cash line only reflects the *reduced* cash amount (or is missing entirely if credit covered the whole thing), with a new line debiting Member Credits Payable for the applied amount.
- Go back to the credit note's detail page — its balance should be reduced, redemption history should show this new entry, and its status should now be `partially_redeemed` or `fully_redeemed`.

### 10. Test void restoring the credit

Void the payment you just created in step 8 (from the receipts list, "Void" action):
- Confirm the credit note's balance is restored back to what it was before step 8, and its status reverts accordingly.
- Separately, try voiding the **original** payment from step 5 (the one the credit note itself came from) — this should be **blocked** with a message saying it funded a credit note and needs a manual correction.

### 11. (Optional/advanced) Test expiry write-off

This normally only runs once a day via a scheduled job, and only affects credit notes past their expiry date — not practical to test end-to-end without backdating data. If you want to force it:
```bash
curl -X GET http://localhost:3000/api/cron/daily -H "Authorization: Bearer $CRON_SECRET"
```
(`CRON_SECRET` must match the value in your `.env` file.) This runs *all* daily maintenance jobs, not just credit note expiry, so only do this if you're comfortable with that on your dev environment.

---

That covers the full loop: issue → redeem → void → (expire). If anything behaves differently from what's described here, that's the signal something needs fixing — let me know what you see and I'll dig in.
