# WHT Correction Entries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let finance record a historical missed-WHT catch-up against one or more already-posted bills — either already paid to KRA out of pocket, or still pending — without ever writing to `bills`/`bill_items`, and have that catch-up automatically clear the bill's phantom overdue balance and (if pending) feed the existing WHT remittance workflow.

**Architecture:** A new `wht-corrections` feature, structurally mirroring the existing `wht-remittances` feature (header+lines tables, server-fn API returning `Result`, TanStack Query + TanStack Form UI, permission-gated routes). Two new tables (`wht_corrections`, `wht_correction_lines`) post a balanced journal entry per correction — DR the user-chosen treatment account, CR either the crediting bank/cash account (`already_remitted`) or `wht_payable` (`pending`, resolved via `resolveAccountRole`) — and `vw_wht_balances`/`vw_invoices` are extended to fold correction amounts into the figures they already compute.

**Tech Stack:** TanStack Start (`createServerFn`), Drizzle ORM + Postgres, Zod, TanStack Form (`useAppForm`), TanStack Query, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-29-wht-corrections-design.md`

## Global Constraints

- Never write to `bills` or `bill_items` from this feature, under any circumstance.
- The bill edit-lock rule is not touched or bypassed.
- No `update`/edit capability for corrections — create and delete only. To fix a mistake, delete and recreate.
- No new ledger account is created by this feature; `treatment_account_id` is chosen from the existing chart of accounts.
- Every server mutation is gated with `requirePermission`, follows the `success(...)`/`failure(...)` (`@/lib/result`) return convention, and logs via `logActivity` after the transaction commits.
- Do not commit any changes — leave the working tree for manual review (explicit instruction from the project owner for this feature).

## Review Focus

- **A bill referenced in a correction line no longer belongs to any vendor/date range assumption** — a correction line must still resolve to a real bill for the journal memo and report row to make sense; an orphaned `billId` (deleted bill — not currently possible since bills are never hard-deleted, but worth a `NOT NULL`/FK-backed guarantee) should not silently post with blank vendor/invoice info. Covered by the FK constraint (Task 1) plus the `innerJoin` in `getExistingCorrectionsForBills`/`getWhtSchedule` (Tasks 6, 15) — a row that can't join simply won't appear rather than rendering blank.
- **A `pending` correction against a bill whose original `wht_amount` is zero** (the "missed WHT entirely" case) must still surface in the WHT remittance picker — the `vw_wht_balances` `WHERE` clause must not silently exclude it. Covered by Task 2's migration and exercised by the manual verification in Task 17.
- **`already_remitted` with `paymentMethod` cash/mpesa vs bank/cheque** — the conditional-required-field logic (remittance date, bank vs cash-equivalent account) is the single most likely place for a copy-paste schema bug, since it's adapted line-by-line from `remittanceFormSchema`. Covered by Task 4's schema tests.
- **Two correction lines in the same submission referencing the same bill** — nothing in the schema or posting logic forbids this (unlike the cross-correction duplicate warning, which is soft and only checks across different corrections). A user could accidentally double-enter the same bill twice within one correction and silently double the amount owed. Covered by Task 4's schema tests (a `superRefine` check for duplicate `billId`s within one submission).
- **`grossAmount` is `null` on correction rows in the WHT Schedule report** — `summariseWhtSchedule`'s summation must not throw or produce `NaN` when a row's `grossAmount` is `null`, and the group/overall gross total must still be numerically correct (a `NaN` here would silently corrupt every total on the report, including for billing-only periods once any correction exists anywhere in the data set feeding that render). Covered by Task 15's tests.

---

## File Structure

```
src/drizzle/schemas/bill.ts                                  [MODIFY] enum, 2 tables, relations, vw_wht_balances stub
src/drizzle/migrations/<generated>.sql                        [CREATE] tables + view DROP/CREATE (hand-edited after db:generate)

src/lib/permissions/constants.ts                              [MODIFY] 3 new permission strings
src/lib/constants.ts                                           [MODIFY] nav entry

src/features/wht-corrections/
  lib/correction-totals.ts                                    [CREATE] pure posting-math helpers
  lib/correction-totals.test.ts                                [CREATE]
  services/schemas.ts                                         [CREATE] correctionFormSchema
  services/schemas.test.ts                                     [CREATE]
  services/wht-corrections.api.ts                              [CREATE] server fns
  services/queries.ts                                          [CREATE] correctionQueries
  utils/lib.ts                                                 [CREATE] transform helpers
  components/correction-form.tsx                               [CREATE]
  components/corrections-table.tsx                             [CREATE]
  components/correction-details.tsx                            [CREATE]

src/routes/app/wht-corrections/
  route.tsx                                                    [CREATE]
  index.tsx                                                    [CREATE]
  new.tsx                                                      [CREATE]
  $correctionId/details.tsx                                    [CREATE]

src/features/reports/services/wht-schedule.api.ts               [MODIFY] merge in correction rows
src/features/reports/lib/wht-schedule.ts                        [MODIFY] extend row type + null-safe summing
src/features/reports/lib/wht-schedule.test.ts                   [MODIFY] extend tests
src/features/reports/components/wht-schedule-report.tsx         [MODIFY] Type/Status columns
src/features/reports/components/downloadable-wht-schedule.tsx   [MODIFY] Type/Status columns
```

---

### Task 1: Schema — enum, tables, relations

**Files:**
- Modify: `src/drizzle/schemas/bill.ts`

**Interfaces:**
- Produces: `whtCorrectionStatusEnum` (pgEnum, values `"already_remitted" | "pending"`), `whtCorrections` table (`pgTable`), `whtCorrectionLines` table, `whtCorrectionsRelations`, `whtCorrectionLinesRelations`, and an updated `vwWhtBalances` view stub carrying a new `pendingCorrectionAmount` column. All later tasks import these from `@/drizzle/schema`.

Note on scope: the approved design spec listed `payment_method` as a stored column on `wht_corrections`. Following the exact precedent this feature mirrors — `wht_remittances` does **not** persist `paymentMethod`; it stores only `bankId`/`creditingAccountId` and (since that feature has an edit flow) re-derives the method on read from whether `bankId` is set. Since `wht_corrections` has no edit flow at all, there's nothing to re-derive for — `paymentMethod` is pure transient form state, never written to the database. This keeps the table shape consistent with its closest sibling rather than diverging for no behavioral gain.

- [ ] **Step 1: Add the enum, right after `WHT_CATEGORIES`/`whtCategoryEnum` (around line 72)**

```ts
/**
 * Whether a missed-WHT catch-up has already been paid to KRA out of pocket
 * (settled, no WHT Payable involved) or is still owed (feeds the existing
 * WHT Payable + remittance workflow via `vw_wht_balances`).
 */
export const WHT_CORRECTION_STATUSES = ["already_remitted", "pending"] as const;
export const whtCorrectionStatusEnum = pgEnum(
	"wht_correction_status",
	WHT_CORRECTION_STATUSES,
);
```

- [ ] **Step 2: Add the two tables and their relations, after `whtRemittanceLinesRelations` (around line 360, before `recurringBillsSchedules`)**

```ts
/**
 * A historical missed-WHT catch-up against one or more already-posted bills,
 * recorded without ever editing the original bill. `already_remitted` means
 * the business already paid KRA out of its own funds outside the app (a pure
 * bookkeeping catch-up, no WHT Payable involved); `pending` means the money
 * hasn't gone to KRA yet, so it feeds the existing WHT Payable + remittance
 * workflow through `vw_wht_balances` instead.
 *
 * There is no edit flow: a mistake is fixed by deleting and recreating, so
 * `paymentMethod` is never persisted here — unlike `wht_remittances`, which
 * keeps it implicit and re-derives it for its own edit form.
 */
export const whtCorrections = pgTable(
	"wht_corrections",
	{
		id,
		correctionNo: integer("correction_no").notNull(),
		correctionDate: date("correction_date").notNull(),
		treatmentAccountId: integer("treatment_account_id")
			.notNull()
			.references(() => ledgerAccounts.id),
		remittanceStatus: whtCorrectionStatusEnum("remittance_status").notNull(),
		remittanceDate: date("remittance_date"),
		bankId: varchar("bank_id").references(() => bankAccounts.id),
		creditingAccountId: integer("crediting_account_id").references(
			() => ledgerAccounts.id,
		),
		memo: text("memo"),
		createdBy: varchar("created_by")
			.notNull()
			.references(() => users.id),
		createdAt,
		updatedAt,
	},
	(table) => [
		index("idx_wht_corrections_correction_no").on(table.correctionNo),
		index("idx_wht_corrections_correction_date").on(table.correctionDate),
	],
);

export const whtCorrectionsRelations = relations(
	whtCorrections,
	({ one, many }) => ({
		lines: many(whtCorrectionLines),
		bank: one(bankAccounts, {
			fields: [whtCorrections.bankId],
			references: [bankAccounts.id],
		}),
		treatmentAccount: one(ledgerAccounts, {
			fields: [whtCorrections.treatmentAccountId],
			references: [ledgerAccounts.id],
		}),
	}),
);

export const whtCorrectionLines = pgTable(
	"wht_correction_lines",
	{
		id: serial("id").primaryKey(),
		lineNumber: integer("line_number").notNull(),
		correctionId: varchar("correction_id")
			.notNull()
			.references(() => whtCorrections.id, { onDelete: "cascade" }),
		// Reference only, for traceability — never used to modify the bill.
		billId: varchar("bill_id")
			.notNull()
			.references(() => bills.id),
		whtCategory: whtCategoryEnum("wht_category").notNull(),
		// Informational only — what rate should have applied. Never used in posting.
		whtRate: decimal("wht_rate", { precision: 5, scale: 2 }).notNull(),
		amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
	},
	(table) => [
		index("idx_wht_correction_lines_correction_id").on(table.correctionId),
		index("idx_wht_correction_lines_bill_id").on(table.billId),
	],
);

export const whtCorrectionLinesRelations = relations(
	whtCorrectionLines,
	({ one }) => ({
		correction: one(whtCorrections, {
			fields: [whtCorrectionLines.correctionId],
			references: [whtCorrections.id],
		}),
		bill: one(bills, {
			fields: [whtCorrectionLines.billId],
			references: [bills.id],
		}),
	}),
);
```

- [ ] **Step 3: Add `correctionLines: many(whtCorrectionLines)` to `billsRelations` (line 143-151)**

```ts
export const billsRelations = relations(bills, ({ one, many }) => ({
	items: many(billItems),
	payments: many(billPaymentLines),
	whtRemittances: many(whtRemittanceLines),
	correctionLines: many(whtCorrectionLines),
	vendor: one(vendors, {
		fields: [bills.vendorId],
		references: [vendors.id],
	}),
}));
```

- [ ] **Step 4: Update the `vwWhtBalances` view stub (lines 410-426) to add `pendingCorrectionAmount`**

```ts
export const vwWhtBalances = pgView("vw_wht_balances", {
	id: varchar("id").notNull(),
	invoiceDate: date("invoice_date").notNull(),
	invoiceNo: varchar("invoice_no").notNull(),
	vendorId: varchar("vendor_id").notNull(),
	name: varchar("name").notNull(),
	taxPin: varchar("tax_pin"),
	total: numeric("total", { precision: 10, scale: 2 }).notNull(),
	whtAmount: numeric("wht_amount", { precision: 10, scale: 2 }).notNull(),
	pendingCorrectionAmount: numeric("pending_correction_amount", {
		precision: 10,
		scale: 2,
	}).notNull(),
	remittedAmount: numeric("remitted_amount", {
		precision: 10,
		scale: 2,
	}).notNull(),
	whtBalance: numeric("wht_balance", { precision: 10, scale: 2 }).notNull(),
	whtCertificateNo: varchar("wht_certificate_no"),
	whtCertificateIssuedDate: date("wht_certificate_issued_date"),
}).existing();
```

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: PASS (no schema-only change breaks typechecking; `vwInvoices`'s stub is untouched in this task since its column set doesn't change — only its SQL body changes in Task 2).

- [ ] **Step 6: Do not commit** (per this feature's explicit instruction — leave the change in the working tree).

---

### Task 2: Migration — tables + view SQL

**Files:**
- Create: `src/drizzle/migrations/<generated>.sql` (drizzle-kit names it, e.g. `0096_<two-word-slug>.sql`)
- Modify (auto-generated, do not hand-edit): `src/drizzle/migrations/meta/_journal.json`, `src/drizzle/migrations/meta/<NNNN>_snapshot.json`

**Interfaces:**
- Consumes: the schema from Task 1.
- Produces: the `wht_correction_status` Postgres enum, `wht_corrections`/`wht_correction_lines` tables, and the redefined `vw_wht_balances`/`vw_invoices` views that Tasks 6+ query against.

- [ ] **Step 1: Generate the migration for the new enum/tables**

Run: `pnpm db:generate`

This produces a new file `src/drizzle/migrations/00NN_<slug>.sql` containing `CREATE TYPE "public"."wht_correction_status" AS ENUM(...)`, `CREATE TABLE "wht_corrections" (...)`, `CREATE TABLE "wht_correction_lines" (...)`, and the two `ALTER TABLE ... ADD CONSTRAINT` FK statements, each separated by `--> statement-breakpoint`. Note the exact filename it produces — the rest of this task edits that same file.

- [ ] **Step 2: Verify the generated DDL matches Task 1's schema**

Open the generated file and confirm every column or index from Task 1 Steps 2 appears (column names, types, `NOT NULL`, defaults, FK targets, `ON DELETE CASCADE` on `wht_correction_lines.correction_id`). Fix schema.ts and re-run `db:generate` if anything is missing — don't hand-patch a mismatch into the SQL.

- [ ] **Step 3: Append the view redefinition to the same generated file**

Following the exact precedent of `src/drizzle/migrations/0093_wht_balance_views.sql` (`DROP VIEW ... CASCADE` then `CREATE VIEW`, statements separated by `--> statement-breakpoint`), append:

```sql
--> statement-breakpoint

-- Withholding tax corrections retroactively adjust two things this view
-- already computes: the vendor's net payable (regardless of whether the
-- catch-up has been remitted to KRA yet — the vendor was never entitled to
-- it either way) and, for corrections still owed to KRA, the WHT balance
-- available to remit. See docs/superpowers/specs/2026-09-29-wht-corrections-design.md.
DROP VIEW IF EXISTS vw_invoices CASCADE;
--> statement-breakpoint

CREATE VIEW vw_invoices AS
SELECT
	b.id,
	b.invoice_date,
	b.due_date,
	b.vendor_id,
	b.invoice_no,
	v.name,
	b.total,
	b.wht_amount,
	b.total - COALESCE(b.wht_amount, 0::numeric) - COALESCE(wc.amount, 0::numeric) AS net_payable,
	COALESCE(sum(bpl.amount), 0::numeric) AS total_payment,
	(b.total - COALESCE(b.wht_amount, 0::numeric) - COALESCE(wc.amount, 0::numeric)) - COALESCE(sum(bpl.amount), 0::numeric) AS balance,
	b.status,
	(
		b.due_date IS NOT NULL
		AND b.due_date < CURRENT_DATE
		AND (b.total - COALESCE(b.wht_amount, 0::numeric) - COALESCE(wc.amount, 0::numeric)) - COALESCE(sum(bpl.amount), 0::numeric) > 0::numeric
		AND b.status <> ALL (ARRAY['draft'::bill_status, 'cancelled'::bill_status])
	) AS is_overdue,
	(b.status <> ALL (ARRAY['draft'::bill_status, 'cancelled'::bill_status])) AS is_payable,
	CASE
		WHEN b.status = ANY (ARRAY['draft'::bill_status, 'cancelled'::bill_status]) THEN b.status
		WHEN (b.total - COALESCE(b.wht_amount, 0::numeric) - COALESCE(wc.amount, 0::numeric)) - COALESCE(sum(bpl.amount), 0::numeric) <= 0::numeric THEN 'paid'::bill_status
		WHEN b.due_date IS NOT NULL AND b.due_date < CURRENT_DATE THEN 'overdue'::bill_status
		WHEN COALESCE(sum(bpl.amount), 0::numeric) > 0::numeric THEN 'partially-paid'::bill_status
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
--> statement-breakpoint

DROP VIEW IF EXISTS vw_wht_balances CASCADE;
--> statement-breakpoint

-- pending_correction_amount adds unremitted correction amounts into the
-- balance available to remit, and widens which bills appear: a bill with
-- zero original wht_amount but a pending correction (WHT missed entirely)
-- must still surface here, or it could never be remitted.
CREATE VIEW vw_wht_balances AS
SELECT
	b.id,
	b.invoice_date,
	b.invoice_no,
	b.vendor_id,
	v.name,
	v.tax_pin,
	b.total,
	b.wht_amount,
	COALESCE(pc.amount, 0::numeric) AS pending_correction_amount,
	COALESCE(sum(wrl.amount), 0::numeric) AS remitted_amount,
	(b.wht_amount + COALESCE(pc.amount, 0::numeric)) - COALESCE(sum(wrl.amount), 0::numeric) AS wht_balance,
	b.wht_certificate_no,
	b.wht_certificate_issued_date
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
WHERE (b.wht_amount > 0::numeric OR pc.amount > 0::numeric)
	AND b.status <> ALL (ARRAY['draft'::bill_status, 'cancelled'::bill_status])
GROUP BY b.id, b.invoice_date, b.invoice_no, b.vendor_id, v.name, v.tax_pin, b.total, b.wht_amount, pc.amount, b.wht_certificate_no, b.wht_certificate_issued_date
ORDER BY b.invoice_date DESC, b.invoice_no DESC;
```

Before finalizing, confirm nothing else in the codebase depends on `vw_invoices`/`vw_wht_balances` in a way `CASCADE` would silently drop — search `src/drizzle/migrations/*.sql` for other `CREATE VIEW` statements referencing either name:

Run: `grep -rn "vw_invoices\|vw_wht_balances" src/drizzle/migrations/*.sql`
Expected: only the `0093_...` and this new migration reference them — no third view depends on either.

- [ ] **Step 4: Apply the migration**

Run: `pnpm db:migrate`
Expected: migration applies cleanly against the configured dev database.

- [ ] **Step 5: Verify the view shapes**

Run: `psql "$DATABASE_URL" -c "\d wht_corrections" -c "\d wht_correction_lines" -c "\d vw_wht_balances" -c "\d vw_invoices"`
Expected: `vw_wht_balances` lists `pending_correction_amount`; `vw_invoices`'s column list is unchanged (only the underlying SQL body changed, not its shape); both new tables exist with the FKs from Task 1.

- [ ] **Step 6: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 7: Do not commit.**

---

### Task 3: Permissions and navigation

**Files:**
- Modify: `src/lib/permissions/constants.ts:46-49` (directly after the `wht-remittances:*` block)

**Interfaces:**
- Produces: `"wht-corrections:view" | "wht-corrections:create" | "wht-corrections:delete"` as valid `Permission` values, consumed by every `requirePermission(...)` call in Task 6-8 and every route's `beforeLoad` in Task 14.

Note: the nav entry originally planned for this task moved to Task 14 (found during implementation — `src/lib/constants.ts`'s nav array is typed against `url: keyof FileRoutesByTo`, generated from the actual route tree, so it cannot reference `/app/wht-corrections` before that route exists. Adding the nav entry in the same task that creates the route avoids the chicken-and-egg typecheck failure).

- [ ] **Step 1: Add the permission keys**

```ts
	"wht-remittances:view",
	"wht-remittances:create",
	"wht-remittances:update",
	"wht-remittances:delete",
	"wht-corrections:view",
	"wht-corrections:create",
	"wht-corrections:delete",
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Reseed permissions so the new keys exist for whichever role should have them**

Run: `pnpm db:seed`
Expected: the seed's `onConflictDoNothing` inserts the three new rows into `permissions` without touching existing ones (per `src/drizzle/seed/permissions.ts`).

- [ ] **Step 4: Do not commit.**

---

### Task 4: Zod schema

**Files:**
- Create: `src/features/wht-corrections/services/schemas.ts`
- Create: `src/features/wht-corrections/services/schemas.test.ts`

**Interfaces:**
- Produces: `correctionFormSchema` (Zod), `type CorrectionFormValues = z.infer<typeof correctionFormSchema>`. Consumed by `createCorrection`'s `.validator(...)` (Task 7) and `correction-form.tsx` (Task 11).

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { correctionFormSchema } from "@/features/wht-corrections/services/schemas";

const baseLine = {
	billId: "bill_1",
	whtCategory: "professional_management_training_fee" as const,
	whtRate: 5,
	amount: 500,
};

const basePending = {
	correctionNo: "1",
	correctionDate: "2026-09-29",
	treatmentAccountId: "42",
	remittanceStatus: "pending" as const,
	remittanceDate: null,
	paymentMethod: null,
	bankId: null,
	cashEquivalentAccountId: null,
	memo: null,
	lines: [baseLine],
};

describe("correctionFormSchema", () => {
	it("accepts a pending correction with no remittance fields", () => {
		const result = correctionFormSchema.safeParse(basePending);
		expect(result.success).toBe(true);
	});

	it("requires at least one line", () => {
		const result = correctionFormSchema.safeParse({ ...basePending, lines: [] });
		expect(result.success).toBe(false);
	});

	it("rejects an already_remitted correction with no remittance date", () => {
		const result = correctionFormSchema.safeParse({
			...basePending,
			remittanceStatus: "already_remitted",
			paymentMethod: "bank",
			bankId: "bank_1",
		});
		expect(result.success).toBe(false);
	});

	it("rejects bank/cheque with no bank selected", () => {
		const result = correctionFormSchema.safeParse({
			...basePending,
			remittanceStatus: "already_remitted",
			remittanceDate: "2026-09-01",
			paymentMethod: "cheque",
		});
		expect(result.success).toBe(false);
	});

	it("rejects cash/mpesa with no cash-equivalent account selected", () => {
		const result = correctionFormSchema.safeParse({
			...basePending,
			remittanceStatus: "already_remitted",
			remittanceDate: "2026-09-01",
			paymentMethod: "mpesa",
		});
		expect(result.success).toBe(false);
	});

	it("accepts already_remitted paid via mpesa with a cash-equivalent account", () => {
		const result = correctionFormSchema.safeParse({
			...basePending,
			remittanceStatus: "already_remitted",
			remittanceDate: "2026-09-01",
			paymentMethod: "mpesa",
			cashEquivalentAccountId: "17",
		});
		expect(result.success).toBe(true);
	});

	it("accepts already_remitted paid via bank with a bank selected", () => {
		const result = correctionFormSchema.safeParse({
			...basePending,
			remittanceStatus: "already_remitted",
			remittanceDate: "2026-09-01",
			paymentMethod: "bank",
			bankId: "bank_1",
		});
		expect(result.success).toBe(true);
	});

	it("rejects the same bill referenced twice in one submission", () => {
		const result = correctionFormSchema.safeParse({
			...basePending,
			lines: [baseLine, { ...baseLine, amount: 100 }],
		});
		expect(result.success).toBe(false);
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run src/features/wht-corrections/services/schemas.test.ts`
Expected: FAIL — `Cannot find module '@/features/wht-corrections/services/schemas'`.

- [ ] **Step 3: Write the schema**

```ts
import { z } from "zod";
import { WHT_CATEGORIES } from "@/drizzle/schema";

// invoiceNo/vendorName are deliberately not part of this schema: they are
// display-only and looked up from the correctable-bills list by `billId`
// wherever the UI needs them (the bill combobox's own label, the duplicate
// warning banner), rather than duplicated into form/submission state.
export const correctionLineSchema = z.object({
	billId: z.string().min(1, { error: "Bill is required" }),
	whtCategory: z.enum(WHT_CATEGORIES, { error: "Category is required" }),
	whtRate: z.number().positive("Rate must be greater than zero"),
	amount: z.number().positive("Amount must be greater than zero"),
});

/**
 * `already_remitted` covers a catch-up already paid to KRA out of pocket —
 * pure historical bookkeeping, no WHT Payable involved. `pending` is a missed
 * WHT still owed, and feeds the existing WHT Payable + remittance workflow.
 * There is no edit flow (mistakes are fixed by delete + recreate), so unlike
 * the WHT remittance form's schema, this one never carries an `id`.
 */
export const correctionFormSchema = z
	.object({
		correctionNo: z.string().min(1, "Correction number is required"),
		correctionDate: z.iso.date({ error: "Invalid date" }),
		treatmentAccountId: z
			.string()
			.min(1, { error: "Treatment account is required" }),
		remittanceStatus: z.enum(["already_remitted", "pending"], {
			error: "Remittance status is required",
		}),
		remittanceDate: z.iso.date().nullish(),
		paymentMethod: z.enum(["cash", "mpesa", "bank", "cheque"]).nullish(),
		bankId: z.string().nullish(),
		cashEquivalentAccountId: z.string().nullish(),
		memo: z.string().nullish(),
		lines: z
			.array(correctionLineSchema)
			.min(1, { error: "At least one line is required" }),
	})
	.superRefine((data, ctx) => {
		const billIds = data.lines.map((line) => line.billId);
		if (new Set(billIds).size !== billIds.length) {
			ctx.addIssue({
				code: "custom",
				message: "The same bill cannot be listed twice in one correction",
				path: ["lines"],
			});
		}

		if (data.remittanceStatus !== "already_remitted") return;

		if (!data.remittanceDate) {
			ctx.addIssue({
				code: "custom",
				message: "Remittance date is required",
				path: ["remittanceDate"],
			});
		}

		if (!data.paymentMethod) {
			ctx.addIssue({
				code: "custom",
				message: "Payment method is required",
				path: ["paymentMethod"],
			});
			return;
		}

		if (
			(data.paymentMethod === "cash" || data.paymentMethod === "mpesa") &&
			!data.cashEquivalentAccountId
		) {
			ctx.addIssue({
				code: "custom",
				message: "Account is required",
				path: ["cashEquivalentAccountId"],
			});
		}

		if (
			(data.paymentMethod === "bank" || data.paymentMethod === "cheque") &&
			!data.bankId
		) {
			ctx.addIssue({
				code: "custom",
				message: "Bank is required",
				path: ["bankId"],
			});
		}
	});

export type CorrectionFormValues = z.infer<typeof correctionFormSchema>;
export type CorrectionLineValues = z.infer<typeof correctionLineSchema>;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run src/features/wht-corrections/services/schemas.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Do not commit.**

---

### Task 5: Pure posting-math helpers

**Files:**
- Create: `src/features/wht-corrections/lib/correction-totals.ts`
- Create: `src/features/wht-corrections/lib/correction-totals.test.ts`

**Interfaces:**
- Produces: `sumCorrectionLines(lines: Array<{ amount: number }>): number`, `buildCorrectionJournalLines(params): Array<{ accountId: number; amount: string; dc: "debit" | "credit"; lineNumber: number; memo?: string | null }>`. Consumed by `createCorrection` (Task 7) and directly unit-tested here so the DR=CR invariant is pinned without a database.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { areJournalValuesBalanced } from "@/services/journal";
import {
	buildCorrectionJournalLines,
	sumCorrectionLines,
} from "@/features/wht-corrections/lib/correction-totals";

describe("sumCorrectionLines", () => {
	it("sums line amounts", () => {
		expect(sumCorrectionLines([{ amount: 100 }, { amount: 250.5 }])).toBe(
			350.5,
		);
	});

	it("rounds to the cent", () => {
		expect(
			sumCorrectionLines([{ amount: 100.111 }, { amount: 50.114 }]),
		).toBe(150.23);
	});

	it("is zero for no lines", () => {
		expect(sumCorrectionLines([])).toBe(0);
	});
});

describe("buildCorrectionJournalLines", () => {
	it("debits the treatment account and credits the resolved account for the same total", () => {
		const lines = buildCorrectionJournalLines({
			treatmentAccountId: 42,
			creditAccountId: 17,
			total: 500,
			memo: "March catch-up",
		});

		expect(lines).toEqual([
			{
				accountId: 42,
				amount: "500",
				dc: "debit",
				lineNumber: 1,
				memo: "March catch-up",
			},
			{
				accountId: 17,
				amount: "500",
				dc: "credit",
				lineNumber: 2,
				memo: "March catch-up",
			},
		]);
	});

	it("always produces a balanced journal", () => {
		const lines = buildCorrectionJournalLines({
			treatmentAccountId: 1,
			creditAccountId: 2,
			total: 333.33,
			memo: null,
		});

		expect(areJournalValuesBalanced(lines)).toBe(true);
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run src/features/wht-corrections/lib/correction-totals.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
import { roundDecimal, toNumber } from "@/lib/helpers";

export function sumCorrectionLines(
	lines: Array<{ amount: number }>,
): number {
	return roundDecimal(
		lines.reduce((total, line) => total + toNumber(line.amount), 0),
	);
}

type BuildCorrectionJournalLinesParams = {
	treatmentAccountId: number;
	creditAccountId: number;
	total: number;
	memo?: string | null;
};

/**
 * Every correction posts exactly two lines: DR the treatment account the
 * user chose, CR whichever account was resolved for the scenario (a bank/
 * cash-equivalent account for `already_remitted`, `wht_payable` for
 * `pending`). Both sides always carry the same total, so this can never
 * produce an unbalanced entry.
 */
export function buildCorrectionJournalLines({
	treatmentAccountId,
	creditAccountId,
	total,
	memo,
}: BuildCorrectionJournalLinesParams) {
	return [
		{
			accountId: treatmentAccountId,
			amount: total.toString(),
			dc: "debit" as const,
			lineNumber: 1,
			memo,
		},
		{
			accountId: creditAccountId,
			amount: total.toString(),
			dc: "credit" as const,
			lineNumber: 2,
			memo,
		},
	];
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run src/features/wht-corrections/lib/correction-totals.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Do not commit.**

---

### Task 6: Server API — read endpoints

**Files:**
- Create: `src/features/wht-corrections/services/wht-corrections.api.ts`

**Interfaces:**
- Consumes: `whtCorrectionLines`, `whtCorrections`, `bills`, `vendors` (`@/drizzle/schema`); `requirePermission` (`@/lib/permissions/permissions`); `authMiddleware` (`@/middlewares/auth-middleware`).
- Produces (this task): `getCorrectionNo(): Promise<number>`, `getCorrectableBills(): Promise<Array<{ id: string; invoiceNo: string; invoiceDate: string; vendorName: string }>>`, `getExistingCorrectionsForBills(billIds: string[]): Promise<Array<{ billId: string; correctionNo: number }>>`, `getCorrections({ data: { q } })`, `getCorrection({ data: correctionId })`. Consumed by `queries.ts` (Task 9) and the components in Tasks 11-13. `createCorrection`/`deleteCorrection` are added to this same file in Tasks 7-8.

- [ ] **Step 1: Write the file**

```ts
import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { desc, eq, ilike, inArray, notInArray, or, sql, sum } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/drizzle/db";
import { bills, vendors, whtCorrectionLines, whtCorrections } from "@/drizzle/schema";
import { requirePermission } from "@/lib/permissions/permissions";
import { searchValidateSchema } from "@/lib/schema-rules";
import { authMiddleware } from "@/middlewares/auth-middleware";

export const getCorrectionNo = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		const result = await db.execute<{ correctionNo: number }>(
			`SELECT COALESCE(MAX(correction_no), 0) as "correctionNo" FROM wht_corrections`,
		);
		return (result.rows[0]?.correctionNo ?? 0) + 1;
	});

/**
 * Bills a correction line can reference: any non-draft, non-cancelled bill,
 * across every vendor. Unlike the WHT remittance picker this is not scoped
 * to bills with an outstanding WHT balance — a correction targets a bill
 * that may have withheld nothing at all, which is the whole point.
 */
export const getCorrectableBills = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		await requirePermission("wht-corrections:create");

		return db
			.select({
				id: bills.id,
				invoiceNo: bills.invoiceNo,
				invoiceDate: bills.invoiceDate,
				vendorName: vendors.name,
			})
			.from(bills)
			.innerJoin(vendors, eq(bills.vendorId, vendors.id))
			.where(notInArray(bills.status, ["draft", "cancelled"]))
			.orderBy(desc(bills.invoiceDate))
			.limit(500);
	});

/**
 * Soft duplicate-warning check: which of the given bills already has a
 * correction line on some other correction. Never blocks submission — the
 * form shows this as a banner, not a validation error.
 */
export const getExistingCorrectionsForBills = createServerFn()
	.middleware([authMiddleware])
	.validator(z.array(z.string()))
	.handler(async ({ data: billIds }) => {
		await requirePermission("wht-corrections:create");

		if (billIds.length === 0) return [];

		return db
			.select({
				billId: whtCorrectionLines.billId,
				correctionNo: whtCorrections.correctionNo,
			})
			.from(whtCorrectionLines)
			.innerJoin(
				whtCorrections,
				eq(whtCorrectionLines.correctionId, whtCorrections.id),
			)
			.where(inArray(whtCorrectionLines.billId, billIds));
	});

export const getCorrections = createServerFn()
	.middleware([authMiddleware])
	.validator(searchValidateSchema)
	.handler(async ({ data: { q } }) => {
		await requirePermission("wht-corrections:view");

		return db
			.select({
				id: whtCorrections.id,
				correctionNo: whtCorrections.correctionNo,
				correctionDate: whtCorrections.correctionDate,
				remittanceStatus: whtCorrections.remittanceStatus,
				memo: whtCorrections.memo,
				amount: sum(whtCorrectionLines.amount),
			})
			.from(whtCorrections)
			.where(
				q
					? or(
							ilike(sql`${whtCorrections.correctionNo}::text`, `%${q}%`),
							ilike(whtCorrections.memo, `%${q}%`),
						)
					: undefined,
			)
			.leftJoin(
				whtCorrectionLines,
				eq(whtCorrections.id, whtCorrectionLines.correctionId),
			)
			.groupBy(
				whtCorrections.id,
				whtCorrections.correctionNo,
				whtCorrections.correctionDate,
				whtCorrections.remittanceStatus,
				whtCorrections.memo,
			)
			.orderBy(desc(whtCorrections.correctionNo))
			.limit(100);
	});

export const getCorrection = createServerFn()
	.middleware([authMiddleware])
	.validator(z.string().min(1, { error: "Correction id is not valid" }))
	.handler(async ({ data: correctionId }) => {
		await requirePermission("wht-corrections:view");

		const correction = await db.query.whtCorrections.findFirst({
			where: eq(whtCorrections.id, correctionId),
			with: {
				bank: { columns: { id: true, bankName: true } },
				treatmentAccount: { columns: { id: true, name: true } },
				lines: {
					orderBy: (t, { asc }) => asc(t.lineNumber),
					with: {
						bill: {
							columns: { id: true, invoiceDate: true, invoiceNo: true },
							with: {
								vendor: { columns: { id: true, name: true, taxPin: true } },
							},
						},
					},
				},
			},
		});

		if (!correction) {
			throw notFound();
		}

		return correction;
	});
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Do not commit.**

---

### Task 7: Server API — `createCorrection`

**Files:**
- Modify: `src/features/wht-corrections/services/wht-corrections.api.ts` (append)

**Interfaces:**
- Consumes: `correctionFormSchema` (Task 4), `sumCorrectionLines`/`buildCorrectionJournalLines` (Task 5), `resolveAccountRole` (`@/services/ledger-account-mappings`), `getCashEquivalentAccountId`/`areJournalValuesBalanced`/`createJournalEntry` (`@/services/journal`), `createBankingEntry` (`@/services/banking`), `findInvalidPostingAccountIdsByType` (`@/features/coa/services/account-option-filter`), `success`/`failure` (`@/lib/result`), `logActivity` (`@/services/activity-logger`).
- Produces: `createCorrection(input: { data: CorrectionFormValues }): Promise<Result<undefined>>`. Consumed by `correction-form.tsx` (Task 11).

- [ ] **Step 1: Append the implementation**

```ts
import { nanoid } from "nanoid";
import { ledgerAccounts } from "@/drizzle/schema";
import {
	buildCorrectionJournalLines,
	sumCorrectionLines,
} from "@/features/wht-corrections/lib/correction-totals";
import { findInvalidPostingAccountIdsByType } from "@/features/coa/services/account-option-filter";
import { correctionFormSchema } from "@/features/wht-corrections/services/schemas";
import { failure, success } from "@/lib/result";
import { logActivity } from "@/services/activity-logger";
import { resolveAccountRole } from "@/services/ledger-account-mappings";
import { createBankingEntry } from "@/services/banking";
import {
	areJournalValuesBalanced,
	createJournalEntry,
	getCashEquivalentAccountId,
} from "@/services/journal";

const JOURNAL_SOURCE = "wht correction";

export const createCorrection = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(correctionFormSchema)
	.handler(
		async ({
			data,
			context: {
				user: { id: userId },
			},
		}) => {
			await requirePermission("wht-corrections:create");

			const {
				correctionDate,
				treatmentAccountId,
				remittanceStatus,
				remittanceDate,
				paymentMethod,
				bankId,
				cashEquivalentAccountId,
				memo,
				lines,
			} = data;

			if (lines.length === 0) {
				return failure({
					type: "ValidationError",
					message: "At least one line is required",
				});
			}

			const total = sumCorrectionLines(lines);

			if (total <= 0) {
				return failure({
					type: "ValidationError",
					message: "Correction amount must be greater than zero",
				});
			}

			const treatmentAccountIdNum = Number(treatmentAccountId);
			const selectableAccounts = await db.query.ledgerAccounts.findMany({
				columns: {
					id: true,
					name: true,
					type: true,
					isActive: true,
					isPosting: true,
					parentId: true,
				},
				where: inArray(ledgerAccounts.id, [treatmentAccountIdNum]),
			});

			const invalidAccountIds = findInvalidPostingAccountIdsByType(
				selectableAccounts,
				[treatmentAccountIdNum],
				["expense", "asset"],
			);

			if (invalidAccountIds.length > 0) {
				return failure({
					type: "ValidationError",
					message:
						"Treatment account must be an active posting asset or expense account.",
				});
			}

			let creditAccountId: number;
			let journalDate: string;
			let resolvedBankId: string | null = null;

			if (remittanceStatus === "already_remitted") {
				if (!remittanceDate) {
					return failure({
						type: "ValidationError",
						message: "Remittance date is required",
					});
				}

				// Zod's superRefine already requires this on the client, but the
				// field stays nullable in CorrectionFormValues, so this guard both
				// narrows the type for getCashEquivalentAccountId and re-checks the
				// invariant server-side, same as the rest of this handler's fields.
				if (!paymentMethod) {
					return failure({
						type: "ValidationError",
						message: "Payment method is required",
					});
				}

				try {
					creditAccountId = await getCashEquivalentAccountId({
						paymentMethod,
						bankId,
						creditingAccountId: cashEquivalentAccountId,
					});
				} catch (error) {
					return failure({
						type: "ValidationError",
						message:
							error instanceof Error
								? error.message
								: "Could not resolve the crediting account",
					});
				}

				journalDate = remittanceDate;
				resolvedBankId =
					paymentMethod === "bank" || paymentMethod === "cheque"
						? (bankId ?? null)
						: null;
			} else {
				try {
					creditAccountId = await resolveAccountRole("wht_payable");
				} catch (error) {
					return failure({
						type: "ValidationError",
						message:
							error instanceof Error
								? error.message
								: "Could not resolve the WHT payable account",
					});
				}
				journalDate = correctionDate;
			}

			const journalLines = buildCorrectionJournalLines({
				treatmentAccountId: treatmentAccountIdNum,
				creditAccountId,
				total,
				memo,
			});

			if (!areJournalValuesBalanced(journalLines)) {
				return failure({
					type: "ApplicationError",
					message: "Journal values are not balanced",
				});
			}

			const correctionNo = await getCorrectionNo();

			try {
				let correctionId = "";

				await db.transaction(async (tx) => {
					const [{ id: insertedId }] = await tx
						.insert(whtCorrections)
						.values({
							id: nanoid(),
							correctionNo,
							correctionDate,
							treatmentAccountId: treatmentAccountIdNum,
							remittanceStatus,
							remittanceDate:
								remittanceStatus === "already_remitted" ? remittanceDate : null,
							bankId: resolvedBankId,
							creditingAccountId: creditAccountId,
							memo,
							createdBy: userId,
						})
						.returning({ id: whtCorrections.id });

					correctionId = insertedId;

					await tx.insert(whtCorrectionLines).values(
						lines.map((line, index) => ({
							lineNumber: index + 1,
							correctionId,
							billId: line.billId,
							whtCategory: line.whtCategory,
							whtRate: line.whtRate.toString(),
							amount: line.amount.toString(),
						})),
					);

					await createJournalEntry({
						entry: {
							source: JOURNAL_SOURCE,
							sourceId: correctionId,
							entryDate: journalDate,
							description: memo || `WHT correction no ${correctionNo}`,
						},
						lines: journalLines,
						tx,
					});

					if (remittanceStatus === "already_remitted" && resolvedBankId) {
						await createBankingEntry({
							entry: {
								source: JOURNAL_SOURCE,
								sourceId: correctionId,
								transactionDate: remittanceDate as string,
								dc: "credit",
								amount: total.toString(),
								reference: memo ?? `WHT correction no ${correctionNo}`,
								bankId: resolvedBankId,
							},
							tx,
						});
					}
				});

				await logActivity({
					data: {
						action: "create wht correction",
						userId,
						description: `Created WHT correction no ${correctionNo}`,
					},
				});

				return success(undefined);
			} catch (error) {
				console.error(error);
				return failure({
					type: "ApplicationError",
					message: "Failed to create WHT correction",
				});
			}
		},
	);
```

Add the missing imports at the top of the file alongside the Task 6 imports: `inArray` (drizzle-orm, already imported in Task 6 — confirm it's there), `db`'s `.query.ledgerAccounts` relies on `ledgerAccounts` being exported from `@/drizzle/schema` (it already is).

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Manual smoke test against a dev database** (no automated DB-integration test harness exists in this repo — every existing service test is a pure-function test on extracted lib helpers, which Task 5 already covers for the posting math)

Run: `pnpm dev`, then from a REPL or a temporary route, call `createCorrection` with a `pending` payload against a real bill id and confirm via `psql`:
```sql
SELECT * FROM wht_corrections ORDER BY created_at DESC LIMIT 1;
SELECT * FROM wht_correction_lines ORDER BY id DESC LIMIT 5;
SELECT * FROM journal_lines WHERE journal_entry_id = (SELECT id FROM journal_entries WHERE source = 'wht correction' ORDER BY id DESC LIMIT 1);
SELECT * FROM vw_wht_balances WHERE id = '<the bill id>';
```
Expected: the journal's two lines balance; `vw_wht_balances.pending_correction_amount` and `wht_balance` reflect the new line. This step is superseded by Task 17's fuller manual pass — skip re-running it if Task 17 is done in the same session.

- [ ] **Step 4: Do not commit.**

---

### Task 8: Server API — `deleteCorrection`

**Files:**
- Modify: `src/features/wht-corrections/services/wht-corrections.api.ts` (append)

**Interfaces:**
- Consumes: `deleteJournalEntry`, `deleteBankingEntry`.
- Produces: `deleteCorrection(input: { data: string }): Promise<Result<undefined>>`. Consumed by `corrections-table.tsx` (Task 12).

- [ ] **Step 1: Append the implementation**

```ts
import { deleteBankingEntry } from "@/services/banking";
import { deleteJournalEntry } from "@/services/journal";

export const deleteCorrection = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(z.string().min(1, { error: "Correction id is not valid" }))
	.handler(
		async ({
			data: correctionId,
			context: {
				user: { id: userId },
			},
		}) => {
			await requirePermission("wht-corrections:delete");

			try {
				const correction = await db.query.whtCorrections.findFirst({
					columns: { id: true, correctionNo: true },
					where: eq(whtCorrections.id, correctionId),
				});

				if (!correction) {
					return failure({
						type: "NotFoundError",
						message: "Correction not found",
					});
				}

				await db.transaction(async (tx) => {
					// Lines cascade with the header, which restores every affected
					// bill's net_payable/wht_balance on the next read.
					await tx
						.delete(whtCorrections)
						.where(eq(whtCorrections.id, correctionId));
					await deleteJournalEntry({
						source: JOURNAL_SOURCE,
						sourceId: correctionId,
						tx,
					});
					await deleteBankingEntry({
						source: JOURNAL_SOURCE,
						sourceId: correctionId,
						tx,
					});
				});

				await logActivity({
					data: {
						action: "delete wht correction",
						userId,
						description: `Deleted WHT correction no ${correction.correctionNo}`,
					},
				});

				return success(undefined);
			} catch (error) {
				console.error(error);
				return failure({
					type: "ApplicationError",
					message: "Failed to delete WHT correction",
				});
			}
		},
	);
```

Note: `deleteBankingEntry` requires both `source` and `sourceId` and simply deletes zero rows when none match (see `src/services/banking.ts:42-55`) — safe to call unconditionally even for a `pending` correction that never created a banking entry, exactly as `wht-remittances.api.ts`'s `deleteRemittance` already does.

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Do not commit.**

---

### Task 9: Query definitions

**Files:**
- Create: `src/features/wht-corrections/services/queries.ts`

**Interfaces:**
- Consumes: every function from Tasks 6-8.
- Produces: `correctionQueries` object, consumed by every component in Tasks 11-13 and every route in Task 14.

- [ ] **Step 1: Write the file**

```ts
import { queryOptions } from "@tanstack/react-query";
import type { z } from "zod";
import {
	getCorrectableBills,
	getCorrection,
	getCorrectionNo,
	getCorrections,
	getExistingCorrectionsForBills,
} from "@/features/wht-corrections/services/wht-corrections.api";
import type { searchValidateSchema } from "@/lib/schema-rules";

export const correctionQueries = {
	all: ["wht-corrections"] as const,
	correctionNo: () =>
		queryOptions({
			queryKey: [...correctionQueries.all, "correctionNo"],
			queryFn: () => getCorrectionNo(),
		}),
	correctableBills: () =>
		queryOptions({
			queryKey: [...correctionQueries.all, "correctable-bills"],
			queryFn: () => getCorrectableBills(),
		}),
	existingCorrectionsForBills: (billIds: Array<string>) =>
		queryOptions({
			queryKey: [...correctionQueries.all, "existing-for-bills", billIds],
			queryFn: () => getExistingCorrectionsForBills({ data: billIds }),
			enabled: billIds.length > 0,
		}),
	list: (filters: z.infer<typeof searchValidateSchema>) =>
		queryOptions({
			queryKey: [...correctionQueries.all, "list", filters],
			queryFn: () => getCorrections({ data: filters }),
		}),
	detail: (correctionId: string) =>
		queryOptions({
			queryKey: [...correctionQueries.all, "detail", correctionId],
			queryFn: () => getCorrection({ data: correctionId }),
		}),
};
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Do not commit.**

---

### Task 10: Transform helpers

**Files:**
- Create: `src/features/wht-corrections/utils/lib.ts`

**Interfaces:**
- Consumes: `getCorrectableBills`'s return type (Task 6), `ComboBoxItem` (`@/components/ui/custom-select`).
- Produces: `toBillComboboxItem`, `newCorrectionLine`. Consumed by `correction-form.tsx` (Task 11).

- [ ] **Step 1: Write the file**

```ts
import type { ComboBoxItem } from "@/components/ui/custom-select";
import type { getCorrectableBills } from "@/features/wht-corrections/services/wht-corrections.api";
import type { CorrectionLineValues } from "@/features/wht-corrections/services/schemas";
import { DEFAULT_WHT_RATE } from "@/features/bills/lib/wht-constants";
import { dateFormat } from "@/lib/helpers";
import { toTitleCase } from "@/lib/utils";

type CorrectableBill = Awaited<ReturnType<typeof getCorrectableBills>>[number];

/** A correctable bill as a `ComboBox` option: "INV-004 · Acme Consulting". */
export const toBillComboboxItem = (bill: CorrectableBill): ComboBoxItem => ({
	value: bill.id,
	label: `${bill.invoiceNo} · ${toTitleCase(bill.vendorName)} (${dateFormat(bill.invoiceDate, "reporting")})`,
});

/** A blank correction line, appended by the form's "Add Line" button. */
export const newCorrectionLine = (): CorrectionLineValues => ({
	billId: "",
	whtCategory: "professional_management_training_fee",
	whtRate: DEFAULT_WHT_RATE,
	amount: 0,
});
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Do not commit.**

---

### Task 11: `CorrectionForm` component

**Files:**
- Create: `src/features/wht-corrections/components/correction-form.tsx`

**Interfaces:**
- Consumes: `correctionFormSchema`/`CorrectionFormValues` (Task 4), `createCorrection` (Task 7), `correctionQueries` (Task 9), `toBillComboboxItem`/`newCorrectionLine` (Task 10), `useFormUpsert` (`@/hooks/use-form-upsert`), `useAppForm` (`@/lib/form`), `PAYMENT_METHODS` (`@/lib/constants`), `WHT_CATEGORIES` (`@/drizzle/schema`).
- Produces: `CorrectionForm`, `CorrectionFormPendingComponent`. Consumed by `new.tsx` (Task 14).

- [ ] **Step 1: Write the component**

```tsx
import { useStore } from "@tanstack/react-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { PlusIcon, TrashIcon } from "lucide-react";
import { useEffect } from "react";
import { AlertErrorComponent } from "@/components/ui/error-component";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { SelectItem } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableFooter,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Wrapper } from "@/components/ui/wrapper";
import { WHT_CATEGORIES } from "@/drizzle/schema";
import { correctionQueries } from "@/features/wht-corrections/services/queries";
import { createCorrection } from "@/features/wht-corrections/services/wht-corrections.api";
import {
	type CorrectionFormValues,
	correctionFormSchema,
} from "@/features/wht-corrections/services/schemas";
import { newCorrectionLine, toBillComboboxItem } from "@/features/wht-corrections/utils/lib";
import { useFormUpsert } from "@/hooks/use-form-upsert";
import { useAppForm } from "@/lib/form";
import { PAYMENT_METHODS } from "@/lib/constants";
import { currencyFormatter, dateFormat } from "@/lib/helpers";
import { toTitleCase } from "@/lib/utils";
import type { Option, Route } from "@/types/index.types";

type CorrectionFormProps = {
	banks: Array<Option>;
	cashEquivalentAccounts: Array<Option>;
	treatmentAccounts: Array<Option>;
	correctionNo?: string;
};

const CATEGORY_LABEL = (category: (typeof WHT_CATEGORIES)[number]) =>
	toTitleCase(category.replaceAll("_", " "));

export function CorrectionForm({
	banks,
	cashEquivalentAccounts,
	treatmentAccounts,
	correctionNo,
}: CorrectionFormProps) {
	const queryClient = useQueryClient();
	const router = useRouter();

	const { isPending, mutate } = useFormUpsert({
		upsertFn: (data: CorrectionFormValues) => createCorrection({ data }),
		entityName: "WHT correction",
		queryKey: ["wht-corrections"],
		// `Route` is generated from the actual route tree, and `/app/wht-corrections`
		// doesn't exist yet at this point in the task sequence (Task 14 creates it).
		// The string is correct and will type-check on its own once that route
		// exists; the cast only bridges the gap created by doing this task before
		// the route that gives it a home.
		navigateTo: "/app/wht-corrections" as Route,
		onSuccessCallback: async () => {
			// A correction retroactively changes both the bill list (net_payable)
			// and the WHT remittance picker (wht_balance).
			queryClient.invalidateQueries({ queryKey: ["bills"] });
			queryClient.invalidateQueries({ queryKey: ["wht-remittances"] });
			await router.invalidate({ sync: true });
		},
	});

	const form = useAppForm({
		defaultValues: {
			correctionNo: correctionNo ?? "",
			correctionDate: dateFormat(new Date()),
			treatmentAccountId: "",
			remittanceStatus: "pending",
			remittanceDate: null,
			paymentMethod: null,
			bankId: null,
			cashEquivalentAccountId: null,
			memo: null,
			lines: [],
		} as CorrectionFormValues,
		validators: {
			onSubmit: correctionFormSchema,
		},
		onSubmit: ({ value }) => {
			mutate(value);
		},
	});

	const [remittanceStatus, paymentMethod, lines] = useStore(form.store, (state) => [
		state.values.remittanceStatus,
		state.values.paymentMethod,
		state.values.lines,
	]);

	const { data: correctableBills, error: billsError } = useQuery(
		correctionQueries.correctableBills(),
	);
	const billItems = (correctableBills ?? []).map(toBillComboboxItem);

	const billIds = lines.map((line) => line.billId).filter(Boolean);
	const { data: existingCorrections } = useQuery(
		correctionQueries.existingCorrectionsForBills(billIds),
	);
	const duplicateBillIds = new Set(
		(existingCorrections ?? []).map((row) => row.billId),
	);

	const isBankAccount = paymentMethod === "bank" || paymentMethod === "cheque";
	const isAlreadyRemitted = remittanceStatus === "already_remitted";

	// Matches the WHT remittance form's identical effect: without it, switching
	// payment method leaves a stale value in the now-hidden field. The server
	// already re-derives the crediting account strictly from paymentMethod
	// (createCorrection nulls out whichever field doesn't apply), so this isn't
	// a correctness bug — but leaving stale form state around is bad hygiene
	// and inconsistent with the sibling form's established pattern.
	useEffect(() => {
		if (paymentMethod === "cash" || paymentMethod === "mpesa") {
			form.setFieldValue("bankId", null);
		} else if (paymentMethod === "bank" || paymentMethod === "cheque") {
			form.setFieldValue("cashEquivalentAccountId", null);
		}
	}, [paymentMethod, form]);

	function invoiceNoFor(billId: string) {
		return correctableBills?.find((bill) => bill.id === billId)?.invoiceNo ?? billId;
	}

	const total = lines.reduce((acc, line) => acc + Number(line.amount || 0), 0);

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
			className="space-y-4"
		>
			<FieldGroup className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
				<form.AppField name="correctionNo">
					{(field) => <field.Input label="Correction No" disabled />}
				</form.AppField>
				<form.AppField name="correctionDate">
					{(field) => (
						<field.Input type="date" label="Correction Date" required />
					)}
				</form.AppField>
				<form.AppField name="treatmentAccountId">
					{(field) => (
						<field.Select
							label="Treatment Account"
							required
							placeholder="Select Treatment Account"
						>
							{treatmentAccounts.map((account) => (
								<SelectItem key={account.value} value={account.value}>
									{account.label}
								</SelectItem>
							))}
						</field.Select>
					)}
				</form.AppField>
				<form.AppField name="remittanceStatus">
					{(field) => (
						<field.Select label="Status" required placeholder="Select Status">
							<SelectItem value="pending">Not yet remitted</SelectItem>
							<SelectItem value="already_remitted">
								Already remitted to KRA
							</SelectItem>
						</field.Select>
					)}
				</form.AppField>
				{isAlreadyRemitted && (
					<>
						<form.AppField name="remittanceDate">
							{(field) => (
								<field.Input type="date" label="Remittance Date" required />
							)}
						</form.AppField>
						<form.AppField name="paymentMethod">
							{(field) => (
								<field.Select
									label="Payment Method"
									required
									placeholder="Select Payment Method"
								>
									{PAYMENT_METHODS.map((method) => (
										<SelectItem key={method.value} value={method.value}>
											{method.label}
										</SelectItem>
									))}
								</field.Select>
							)}
						</form.AppField>
						{isBankAccount ? (
							<form.AppField name="bankId">
								{(field) => (
									<field.Select label="Bank" required placeholder="Select Bank">
										{banks.map((bank) => (
											<SelectItem key={bank.value} value={bank.value}>
												{bank.label}
											</SelectItem>
										))}
									</field.Select>
								)}
							</form.AppField>
						) : (
							<form.AppField name="cashEquivalentAccountId">
								{(field) => (
									<field.Select
										label="Crediting Account"
										required
										placeholder="Select Crediting Account"
									>
										{cashEquivalentAccounts.map((account) => (
											<SelectItem key={account.value} value={account.value}>
												{account.label}
											</SelectItem>
										))}
									</field.Select>
								)}
							</form.AppField>
						)}
					</>
				)}
				<form.AppField name="memo">
					{(field) => (
						<field.Input
							label="Description"
							fieldClassName="md:col-span-3"
							placeholder="e.g. Missed WHT on rent bills, backlog through Aug 2026"
						/>
					)}
				</form.AppField>
			</FieldGroup>

			{billsError && <AlertErrorComponent message={billsError.message} />}
			{duplicateBillIds.size > 0 && (
				<Alert variant="warning">
					<AlertTitle>Bill already has a correction</AlertTitle>
					<AlertDescription>
						{lines
							.filter((line) => duplicateBillIds.has(line.billId))
							.map((line) => invoiceNoFor(line.billId))
							.join(", ")}{" "}
						already appear on another correction. Check you are not entering
						the same catch-up twice.
					</AlertDescription>
				</Alert>
			)}

			<form.Field name="lines" mode="array">
				{(field) => (
					<div className="space-y-4">
						<div className="flex items-center justify-end">
							<Button
								type="button"
								variant="secondary"
								onClick={() => field.pushValue(newCorrectionLine())}
							>
								<PlusIcon className="size-4" aria-hidden="true" />
								Add Line
							</Button>
						</div>
						<div className="overflow-x-auto border rounded-md p-4">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead className="w-[260px]">Bill</TableHead>
										<TableHead className="w-[220px]">Category</TableHead>
										<TableHead className="w-[110px]">Rate %</TableHead>
										<TableHead className="w-[150px]">Amount</TableHead>
										<TableHead className="w-16" />
									</TableRow>
								</TableHeader>
								<TableBody>
									{field.state.value.map((line, index) => (
										// biome-ignore lint/suspicious/noArrayIndexKey: lines have no stable id
										<TableRow key={index}>
											<TableCell>
												<form.AppField name={`lines[${index}].billId`}>
													{(billField) => (
														<billField.Combobox
															label=""
															placeholder="Search bill"
															items={billItems}
														/>
													)}
												</form.AppField>
											</TableCell>
											<TableCell>
												<form.AppField name={`lines[${index}].whtCategory`}>
													{(field) => (
														<field.Select label="" placeholder="Select Category">
															{WHT_CATEGORIES.map((category) => (
																<SelectItem key={category} value={category}>
																	{CATEGORY_LABEL(category)}
																</SelectItem>
															))}
														</field.Select>
													)}
												</form.AppField>
											</TableCell>
											<TableCell>
												<form.AppField name={`lines[${index}].whtRate`}>
													{(field) => (
														<field.Input
															label=""
															type="number"
															step="0.01"
															min={0}
															className="h-8"
														/>
													)}
												</form.AppField>
											</TableCell>
											<TableCell>
												<form.AppField name={`lines[${index}].amount`}>
													{(field) => (
														<field.Input
															label=""
															type="number"
															step="0.01"
															min={0}
															className="h-8"
														/>
													)}
												</form.AppField>
											</TableCell>
											<TableCell>
												<Button
													type="button"
													variant="ghost"
													onClick={() => field.removeValue(index)}
												>
													<TrashIcon className="size-4 text-destructive" aria-hidden="true" />
												</Button>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
								{lines.length > 0 && (
									<TableFooter>
										<TableRow className="bg-background hover:bg-background">
											<TableCell colSpan={3} className="text-right font-semibold">
												Total
											</TableCell>
											<TableCell className="font-semibold tabular-nums">
												{currencyFormatter(total)}
											</TableCell>
											<TableCell />
										</TableRow>
									</TableFooter>
								)}
							</Table>
						</div>
					</div>
				)}
			</form.Field>

			<form.AppForm>
				<form.SubmitButton
					isLoading={isPending}
					buttonText="Submit Correction"
					withReset
				/>
			</form.AppForm>
		</form>
	);
}

export function CorrectionFormPendingComponent() {
	return (
		<div className="space-y-6 w-full">
			<Skeleton className="h-8 w-52 bg-gray-200 dark:bg-gray-800" />
			<Wrapper size="full">
				<PageHeader
					title="New WHT Correction"
					description="Record a missed withholding tax catch-up against one or more posted bills."
				/>
				<div className="space-y-4">
					<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
						{Array.from({ length: 4 }).map((_, i) => (
							<div
								// biome-ignore lint/suspicious/noArrayIndexKey: Skeleton items are static
								key={i}
								className="grid gap-2"
							>
								<Skeleton className="h-4 w-24" />
								<Skeleton className="h-10 w-full" />
							</div>
						))}
					</div>
					<Skeleton className="h-40 w-full" />
				</div>
			</Wrapper>
		</div>
	);
}
```

Before treating this task as done, confirm one thing this snippet assumes: `@/components/ui/alert` exports `Alert`/`AlertTitle`/`AlertDescription` with a `variant="warning"` option — check `src/components/ui/alert.tsx`. If no `warning` variant exists, use whichever non-destructive variant the file defines (or omit `variant` for the default) rather than inventing one. (`form.Field name="lines" mode="array"` with `pushValue`/`removeValue` is not a guess — it's the exact pattern `journal-form.tsx:121-201` already uses for an editable add/remove line list, as opposed to `form.AppField ... mode="array"`, which the codebase uses only for the WHT remittance form's read-only preloaded iteration.)

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS. Fix any prop mismatches surfaced against the real `field.Combobox`/`field.Select`/`Alert` signatures.

- [ ] **Step 3: Do not commit.**

---

### Task 12: `CorrectionsTable` component

**Files:**
- Create: `src/features/wht-corrections/components/corrections-table.tsx`

**Interfaces:**
- Consumes: `correctionQueries.list` (Task 9), `deleteCorrection` (Task 8).
- Produces: `CorrectionsTable`. Consumed by `index.tsx` (Task 14).

- [ ] **Step 1: Write the component**

```tsx
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { FileWarningIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ViewDetailsAction } from "@/components/ui/custom-button";
import { CustomDropdownContent } from "@/components/ui/custom-dropdown-content";
import { CustomDropdownTrigger } from "@/components/ui/custom-dropdown-trigger";
import { DataTable } from "@/components/ui/datatable";
import { DataTableColumnHeader } from "@/components/ui/datatable-column-header";
import { DeleteActionButton } from "@/components/ui/delete-action";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty";
import { PermissionGate } from "@/components/ui/permission-gate";
import { Skeleton } from "@/components/ui/skeleton";
import { correctionQueries } from "@/features/wht-corrections/services/queries";
import { deleteCorrection } from "@/features/wht-corrections/services/wht-corrections.api";
import { useFilters } from "@/hooks/use-filters";
import { currencyFormatter, dateFormat } from "@/lib/helpers";
import { toTitleCase } from "@/lib/utils";

const STATUS_LABEL = {
	already_remitted: "Already remitted",
	pending: "Pending remittance",
} as const;

export function CorrectionsTable() {
	const { filters } = useFilters(getRouteApi("/app/wht-corrections/").id);
	const { data } = useSuspenseQuery(correctionQueries.list(filters));

	const columns: Array<ColumnDef<(typeof data)[0]>> = [
		{
			accessorKey: "correctionNo",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Correction No" />
			),
		},
		{
			accessorKey: "correctionDate",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Correction Date" />
			),
			cell: ({ row }) => dateFormat(row.original.correctionDate, "long"),
		},
		{
			accessorKey: "remittanceStatus",
			header: "Status",
			cell: ({ row }) => (
				<Badge
					variant={
						row.original.remittanceStatus === "pending" ? "outline" : "secondary"
					}
				>
					{STATUS_LABEL[row.original.remittanceStatus]}
				</Badge>
			),
		},
		{
			accessorKey: "memo",
			header: "Description",
			cell: ({ row }) =>
				row.original.memo ? toTitleCase(row.original.memo) : "",
		},
		{
			accessorKey: "amount",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Amount" />
			),
			cell: ({ row }) => (
				<Badge variant="outline">
					{currencyFormatter(row.original.amount ?? 0)}
				</Badge>
			),
		},
		{
			id: "action",
			cell: ({ row: { original: { id } } }) => (
				<DropdownMenu>
					<CustomDropdownTrigger />
					<CustomDropdownContent>
						<PermissionGate
							permission="wht-corrections:view"
							loadingComponent={<Skeleton className="h-4 w-56" />}
						>
							<DropdownMenuItem asChild>
								<Link
									to="/app/wht-corrections/$correctionId/details"
									params={{ correctionId: id }}
								>
									<ViewDetailsAction text="View" />
								</Link>
							</DropdownMenuItem>
						</PermissionGate>
						<PermissionGate
							permission="wht-corrections:delete"
							loadingComponent={<Skeleton className="h-4 w-56" />}
						>
							<DeleteActionButton
								resourceId={id}
								queryKey={["wht-corrections"]}
								deleteAction={deleteCorrection}
								successMessage="WHT correction deleted successfully!"
							/>
						</PermissionGate>
					</CustomDropdownContent>
				</DropdownMenu>
			),
		},
	];

	if (!data.length && !filters.q) {
		return (
			<EmptyState
				title="No WHT Corrections"
				description="You haven't recorded any missed-WHT catch-ups yet."
				buttonName="Create your first correction"
				icon={<FileWarningIcon />}
				path="/app/wht-corrections/new"
			/>
		);
	}

	return <DataTable data={data} columns={columns} />;
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Do not commit.**

---

### Task 13: `CorrectionDetails` component

**Files:**
- Create: `src/features/wht-corrections/components/correction-details.tsx`

**Interfaces:**
- Consumes: `getCorrection`'s return type (Task 6).
- Produces: `CorrectionDetails`, `CorrectionDetailsSkeleton`. Consumed by `$correctionId/details.tsx` (Task 14).

- [ ] **Step 1: Write the component**

```tsx
import { format } from "date-fns";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableFooter,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { MemberInfo } from "@/features/members/components/member-profile";
import type { getCorrection } from "@/features/wht-corrections/services/wht-corrections.api";
import { currencyFormatter, roundDecimal, toNumber } from "@/lib/helpers";
import { toTitleCase } from "@/lib/utils";

const LINE_COLUMNS = ["Vendor", "Bill #", "Bill Date", "Category", "Rate %", "Amount"];

const STATUS_LABEL = {
	already_remitted: "Already remitted to KRA",
	pending: "Not yet remitted",
} as const;

export function CorrectionDetails({
	correction,
}: {
	correction: Awaited<ReturnType<typeof getCorrection>>;
}) {
	const total = roundDecimal(
		correction.lines.reduce((acc, line) => acc + toNumber(line.amount), 0),
	);

	return (
		<div className="space-y-6">
			<PageHeader
				title="WHT Correction Details"
				description={`Correction #${correction.correctionNo} details`}
			/>
			<Card className="shadow-none">
				<CardHeader>
					<CardTitle>Correction Information</CardTitle>
				</CardHeader>
				<CardContent className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-4 md:gap-x-12">
					<MemberInfo
						label="Correction No"
						value={correction.correctionNo.toString()}
					/>
					<MemberInfo
						label="Correction Date"
						value={format(new Date(correction.correctionDate), "dd/MM/yyyy")}
					/>
					<MemberInfo
						label="Status"
						value={STATUS_LABEL[correction.remittanceStatus]}
					/>
					<MemberInfo
						label="Treatment Account"
						value={correction.treatmentAccount ? toTitleCase(correction.treatmentAccount.name) : "-"}
					/>
					{correction.remittanceStatus === "already_remitted" && (
						<>
							<MemberInfo
								label="Remittance Date"
								value={
									correction.remittanceDate
										? format(new Date(correction.remittanceDate), "dd/MM/yyyy")
										: "-"
								}
							/>
							<MemberInfo
								label="Bank"
								value={
									correction.bank?.bankName
										? toTitleCase(correction.bank.bankName)
										: "Cash / Mobile money"
								}
							/>
						</>
					)}
					<MemberInfo label="Amount" value={currencyFormatter(total)} />
					<MemberInfo label="Bills Covered" value={correction.lines.length.toString()} />
				</CardContent>
			</Card>
			<Card className="shadow-none">
				<CardHeader>
					<CardTitle>Bills Covered</CardTitle>
					<CardDescription>
						Each bill this correction retroactively adjusts
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow>
									{LINE_COLUMNS.map((column, index) => (
										<TableHead
											key={column}
											className={index >= 4 ? "text-right" : ""}
										>
											{column}
										</TableHead>
									))}
								</TableRow>
							</TableHeader>
							<TableBody>
								{correction.lines.map((line) => (
									<TableRow key={line.id}>
										<TableCell>{toTitleCase(line.bill.vendor.name)}</TableCell>
										<TableCell>{line.bill.invoiceNo}</TableCell>
										<TableCell>
											{format(new Date(line.bill.invoiceDate), "dd/MM/yyyy")}
										</TableCell>
										<TableCell>{toTitleCase(line.whtCategory.replaceAll("_", " "))}</TableCell>
										<TableCell className="text-right tabular-nums">{line.whtRate}</TableCell>
										<TableCell className="text-right tabular-nums">
											{currencyFormatter(line.amount, false)}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
							<TableFooter>
								<TableRow>
									<TableCell colSpan={5} className="text-right font-bold">
										Total
									</TableCell>
									<TableCell className="text-right font-bold tabular-nums">
										{currencyFormatter(total, false)}
									</TableCell>
								</TableRow>
							</TableFooter>
						</Table>
					</div>
				</CardContent>
			</Card>
			<Card className="shadow-none">
				<CardHeader className="pb-0">
					<CardTitle>Notes</CardTitle>
					<CardDescription>{toTitleCase(correction.memo || "-")}</CardDescription>
				</CardHeader>
			</Card>
		</div>
	);
}

export function CorrectionDetailsSkeleton() {
	return (
		<div className="space-y-6">
			<PageHeader title="WHT Correction Details" description="Loading correction details..." />
			<Card className="shadow-none">
				<CardHeader>
					<CardTitle>Correction Information</CardTitle>
				</CardHeader>
				<CardContent className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-4 md:gap-x-12">
					{Array.from({ length: 6 }).map((_, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: Skeleton items are static
						<div key={i} className="space-y-2">
							<Skeleton className="h-4 w-20" />
							<Skeleton className="h-4 w-32" />
						</div>
					))}
				</CardContent>
			</Card>
			<Card className="shadow-none">
				<CardHeader>
					<CardTitle>Bills Covered</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					{Array.from({ length: 4 }).map((_, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: Skeleton items are static
						<Skeleton key={i} className="h-10 w-full" />
					))}
				</CardContent>
			</Card>
		</div>
	);
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Do not commit.**

---

### Task 14: Routes

**Files:**
- Create: `src/routes/app/wht-corrections/route.tsx`
- Create: `src/routes/app/wht-corrections/index.tsx`
- Create: `src/routes/app/wht-corrections/new.tsx`
- Create: `src/routes/app/wht-corrections/$correctionId/details.tsx`

**Interfaces:**
- Consumes: everything from Tasks 9, 11-13; `accountQueries.activePostingAccountsByAccountType` (`@/features/coa/services/queries`); `bankQueries.list` (`@/features/bankings/services/queries`); `accountQueries.childrenAccountsByParentName` (`@/features/coa/services/queries`).

- [ ] **Step 1: `route.tsx`**

```tsx
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AlertErrorComponent } from "@/components/ui/error-component";

export const Route = createFileRoute("/app/wht-corrections")({
	component: RouteComponent,
	errorComponent: ({ error }) => (
		<AlertErrorComponent message={error.message} />
	),
	staticData: {
		breadcrumb: "WHT Corrections",
	},
});

function RouteComponent() {
	return <Outlet />;
}
```

- [ ] **Step 2: `index.tsx`**

```tsx
import { createFileRoute } from "@tanstack/react-router";
import {
	BasePageComponent,
	BasePageLoadingSkeleton,
} from "@/components/ui/base-page";
import { ProtectedPage } from "@/components/ui/protected-page";
import { CorrectionsTable } from "@/features/wht-corrections/components/corrections-table";
import { useFilters } from "@/hooks/use-filters";
import { requirePermission } from "@/lib/permissions/permissions";
import { searchValidateSchema } from "@/lib/schema-rules";

export const Route = createFileRoute("/app/wht-corrections/")({
	beforeLoad: async () => {
		await requirePermission("wht-corrections:view");
	},
	component: RouteComponent,
	validateSearch: searchValidateSchema,
	head: () => ({
		meta: [{ title: "WHT Corrections / Prime Age Beauty & Fitness Club" }],
	}),
	pendingComponent: BasePageLoadingSkeleton,
});

function RouteComponent() {
	const { filters, setFilters } = useFilters(Route.id);
	return (
		<ProtectedPage permissions={["wht-corrections:view"]}>
			<BasePageComponent
				pageTitle="WHT Corrections"
				pageDescription="Missed withholding tax catch-ups against already-posted bills"
				hasNewButtonLink
				newButtonLinkPath="/app/wht-corrections/new"
				createPermissions={["wht-corrections:create"]}
				defaultSearchValue={filters.q}
				onSearch={(val) => setFilters({ q: val })}
				buttonText="Add Correction"
			>
				<CorrectionsTable />
			</BasePageComponent>
		</ProtectedPage>
	);
}
```

- [ ] **Step 3: `new.tsx`**

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui/page-header";
import { ProtectedPageWithWrapper } from "@/components/ui/protected-page-with-wrapper";
import { bankQueries } from "@/features/bankings/services/queries";
import { accountQueries } from "@/features/coa/services/queries";
import {
	CorrectionForm,
	CorrectionFormPendingComponent,
} from "@/features/wht-corrections/components/correction-form";
import { correctionQueries } from "@/features/wht-corrections/services/queries";
import { requirePermission } from "@/lib/permissions/permissions";
import { transformOptions } from "@/lib/utils";

export const Route = createFileRoute("/app/wht-corrections/new")({
	beforeLoad: async () => {
		await requirePermission("wht-corrections:create");
	},
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "New WHT Correction / Prime Age Beauty & Fitness Club" }],
	}),
	pendingComponent: CorrectionFormPendingComponent,
	loader: async ({ context: { queryClient } }) => {
		const [correctionNo, banks, cashEquivalentAccounts, treatmentAccounts] =
			await Promise.all([
				queryClient.ensureQueryData(correctionQueries.correctionNo()),
				queryClient.ensureQueryData(bankQueries.list()),
				queryClient.ensureQueryData(
					accountQueries.childrenAccountsByParentName(
						"Cash And Cash Equivalents",
					),
				),
				queryClient.ensureQueryData(
					accountQueries.activePostingAccountsByAccountType([
						"expense",
						"asset",
					]),
				),
			]);

		return {
			correctionNo,
			banks: transformOptions(banks, "id", "bankName"),
			cashEquivalentAccounts: transformOptions(cashEquivalentAccounts),
			treatmentAccounts,
		};
	},
	staticData: {
		breadcrumb: "New WHT Correction",
	},
});

function RouteComponent() {
	const { correctionNo, banks, cashEquivalentAccounts, treatmentAccounts } =
		Route.useLoaderData();

	return (
		<ProtectedPageWithWrapper
			hasBackLink
			backPath="/app/wht-corrections"
			buttonText="Corrections List"
			permissions={["wht-corrections:create"]}
		>
			<PageHeader
				title="New WHT Correction"
				description="Record a missed withholding tax catch-up against one or more posted bills."
			/>

			<CorrectionForm
				correctionNo={correctionNo.toString()}
				banks={banks}
				cashEquivalentAccounts={cashEquivalentAccounts}
				treatmentAccounts={treatmentAccounts}
			/>
		</ProtectedPageWithWrapper>
	);
}
```

Confirm `accountQueries.activePostingAccountsByAccountType(["expense", "asset"])`'s resolved type (`Array<Option>`, per `src/features/coa/services/queries.ts:53-64`) matches `CorrectionForm`'s `treatmentAccounts: Array<Option>` prop — no `transformOptions` call needed for it, unlike `banks`/`cashEquivalentAccounts`.

- [ ] **Step 4: `$correctionId/details.tsx`**

```tsx
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ProtectedPageWithWrapper } from "@/components/ui/protected-page-with-wrapper";
import {
	CorrectionDetails,
	CorrectionDetailsSkeleton,
} from "@/features/wht-corrections/components/correction-details";
import { correctionQueries } from "@/features/wht-corrections/services/queries";
import { requirePermission } from "@/lib/permissions/permissions";

export const Route = createFileRoute(
	"/app/wht-corrections/$correctionId/details",
)({
	beforeLoad: async () => {
		await requirePermission("wht-corrections:view");
	},
	head: () => ({
		meta: [
			{ title: "WHT Correction Details / Prime Age Beauty & Fitness Club" },
		],
	}),
	component: RouteComponent,
	loader: async ({ context: { queryClient }, params: { correctionId } }) =>
		queryClient.ensureQueryData(correctionQueries.detail(correctionId)),
	staticData: {
		breadcrumb: (match) =>
			`Correction #${match.loaderData.correctionNo} Details`,
	},
	pendingComponent: CorrectionDetailsSkeleton,
});

function RouteComponent() {
	const { correctionId } = Route.useParams();
	const loaderCorrection = Route.useLoaderData();
	const { data: correction } = useQuery(
		correctionQueries.detail(correctionId),
	);
	return (
		<ProtectedPageWithWrapper
			hasBackLink
			backPath="/app/wht-corrections"
			buttonText="Corrections List"
			permissions={["wht-corrections:view"]}
		>
			<CorrectionDetails correction={correction ?? loaderCorrection} />
		</ProtectedPageWithWrapper>
	);
}
```

- [ ] **Step 5: Regenerate the route tree**

Run: `pnpm dev` briefly (TanStack Router's Vite plugin regenerates `src/routeTree.gen.ts` on file changes) or whatever dedicated route-generation command the project defines — check `package.json` for a `routes` or `tsr generate` script first. Do **not** hand-edit `src/routeTree.gen.ts`.

- [ ] **Step 6: Add the nav entry** (moved here from Task 3 — `src/lib/constants.ts`'s nav array is typed against the generated route tree, so this can only be added once the route tree from Step 5 includes `/app/wht-corrections`)

In `src/lib/constants.ts`, directly after the "WHT Remittances" nav entry:

```ts
			{
				title: "WHT Remittances",
				url: "/app/wht-remittances",
				permission: "wht-remittances:view",
			},
			{
				title: "WHT Corrections",
				url: "/app/wht-corrections",
				permission: "wht-corrections:view",
			},
```

- [ ] **Step 7: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 8: Do not commit.**

---

### Task 15: WHT Schedule report — data

**Files:**
- Modify: `src/features/reports/services/wht-schedule.api.ts`
- Modify: `src/features/reports/lib/wht-schedule.ts`
- Modify: `src/features/reports/lib/wht-schedule.test.ts`

**Interfaces:**
- Produces: extended `WhtScheduleRow` (adds `rowType: "billing" | "correction"`, `remittanceStatus: "already_remitted" | "pending" | null`, and widens `grossAmount` to `string | null`). Consumed by `wht-schedule-report.tsx`/`downloadable-wht-schedule.tsx` (Task 16).

- [ ] **Step 1: Extend the failing tests first**

Modify the `row()` factory and add new test cases in `wht-schedule.test.ts`:

```ts
const row = (overrides: Partial<WhtScheduleRow> = {}): WhtScheduleRow => ({
	rowType: "billing",
	remittanceStatus: null,
	vendor: "acme consulting",
	taxPin: "P051234567A",
	invoiceNo: "INV-001",
	invoiceDate: "2026-03-05",
	description: "audit fees",
	grossAmount: "10000.00",
	rate: "5.00",
	whtAmount: "500.00",
	certificateNo: null,
	...overrides,
});
```

Add, inside the existing `describe("summariseWhtSchedule", ...)` block:

```ts
	it("includes a correction row in its rate band alongside billing rows", () => {
		const summary = summariseWhtSchedule([
			row(),
			row({
				invoiceNo: "INV-004",
				rowType: "correction",
				remittanceStatus: "pending",
				grossAmount: null,
				whtAmount: "100.00",
			}),
		]);

		expect(summary.groups).toHaveLength(1);
		expect(summary.groups[0].rows).toHaveLength(2);
		expect(summary.whtAmount).toBe(600);
	});

	it("does not let a null grossAmount on a correction row corrupt the gross total", () => {
		const summary = summariseWhtSchedule([
			row({ grossAmount: null, rowType: "correction", remittanceStatus: "already_remitted" }),
			row({ invoiceNo: "INV-002" }),
		]);

		expect(summary.grossAmount).toBe(10_000);
		expect(Number.isNaN(summary.grossAmount)).toBe(false);
	});
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `pnpm vitest run src/features/reports/lib/wht-schedule.test.ts`
Expected: FAIL — `grossAmount: null` breaks `toNumber(row.grossAmount)` (or the type doesn't compile yet).

- [ ] **Step 3: Extend `WhtScheduleRow` and make the summation null-safe**

In `src/features/reports/lib/wht-schedule.ts`:

```ts
export type WhtScheduleRow = {
	rowType: "billing" | "correction";
	remittanceStatus: "already_remitted" | "pending" | null;
	vendor: string;
	taxPin: string | null;
	invoiceNo: string;
	invoiceDate: string;
	description: string | null;
	grossAmount: string | null;
	rate: string | null;
	whtAmount: string;
	certificateNo: string | null;
};
```

In `summariseWhtSchedule`, change:

```ts
		group.grossAmount = roundDecimal(
			group.grossAmount + toNumber(row.grossAmount),
		);
```

to:

```ts
		group.grossAmount = roundDecimal(
			group.grossAmount + (row.grossAmount === null ? 0 : toNumber(row.grossAmount)),
		);
```

and the same null guard in the final `grossAmount` reduce at the bottom of the function stays correct as-is (it sums already-rounded per-group numbers, which are never `null`).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run src/features/reports/lib/wht-schedule.test.ts`
Expected: PASS (all existing + 2 new tests).

- [ ] **Step 5: Merge correction rows into the query**

Rewrite `src/features/reports/services/wht-schedule.api.ts`:

```ts
import { createServerFn } from "@tanstack/react-start";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import {
	billItems,
	bills,
	vendors,
	whtCorrectionLines,
	whtCorrections,
} from "@/drizzle/schema";
import { requirePermission } from "@/lib/permissions/permissions";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { whtScheduleFormSchema } from "@/features/reports/services/schema";
import type { WhtScheduleRow } from "@/features/reports/lib/wht-schedule";

function compareScheduleRows(a: WhtScheduleRow, b: WhtScheduleRow) {
	const rateA = a.rate === null ? Number.POSITIVE_INFINITY : Number(a.rate);
	const rateB = b.rate === null ? Number.POSITIVE_INFINITY : Number(b.rate);
	if (rateA !== rateB) return rateA - rateB;
	if (a.vendor !== b.vendor) return a.vendor.localeCompare(b.vendor);
	if (a.invoiceDate !== b.invoiceDate) return a.invoiceDate.localeCompare(b.invoiceDate);
	return a.invoiceNo.localeCompare(b.invoiceNo);
}

/**
 * Every withholding deduction made in a period: bill lines entered at billing
 * time, plus correction lines recorded later. A correction is filed in the
 * period it was actually recorded (`correction_date`), not retroactively
 * into the original bill's period, so the two queries filter on different
 * date columns and are merged and re-sorted in application code rather than
 * unioned in SQL.
 *
 * Draft and cancelled bills are excluded from the billing side: nothing was
 * withheld on a bill that was never posted.
 */
export const getWhtSchedule = createServerFn()
	.middleware([authMiddleware])
	.validator(whtScheduleFormSchema)
	.handler(async ({ data }) => {
		await requirePermission("reports:wht-schedule");
		const { from, to } = data.dateRange;

		const billingRows: Array<WhtScheduleRow> = await db
			.select({
				rowType: sql<"billing">`'billing'`.as("row_type"),
				remittanceStatus: sql<null>`NULL`.as("remittance_status"),
				vendor: vendors.name,
				taxPin: vendors.taxPin,
				invoiceNo: bills.invoiceNo,
				invoiceDate: bills.invoiceDate,
				description: billItems.description,
				grossAmount: billItems.subTotal,
				rate: billItems.whtRate,
				whtAmount: billItems.whtAmount,
				certificateNo: bills.whtCertificateNo,
			})
			.from(billItems)
			.innerJoin(bills, eq(billItems.billId, bills.id))
			.innerJoin(vendors, eq(bills.vendorId, vendors.id))
			.where(
				and(
					eq(billItems.whtApplicable, true),
					sql`${billItems.whtAmount} > 0`,
					gte(bills.invoiceDate, from),
					lte(bills.invoiceDate, to),
					sql`${bills.status} <> ALL (ARRAY['draft'::bill_status, 'cancelled'::bill_status])`,
				),
			);

		const correctionRows: Array<WhtScheduleRow> = await db
			.select({
				rowType: sql<"correction">`'correction'`.as("row_type"),
				remittanceStatus: whtCorrections.remittanceStatus,
				vendor: vendors.name,
				taxPin: vendors.taxPin,
				invoiceNo: bills.invoiceNo,
				invoiceDate: whtCorrections.correctionDate,
				description: whtCorrections.memo,
				grossAmount: sql<null>`NULL`.as("gross_amount"),
				rate: whtCorrectionLines.whtRate,
				whtAmount: whtCorrectionLines.amount,
				certificateNo: bills.whtCertificateNo,
			})
			.from(whtCorrectionLines)
			.innerJoin(
				whtCorrections,
				eq(whtCorrectionLines.correctionId, whtCorrections.id),
			)
			.innerJoin(bills, eq(whtCorrectionLines.billId, bills.id))
			.innerJoin(vendors, eq(bills.vendorId, vendors.id))
			.where(
				and(
					gte(whtCorrections.correctionDate, from),
					lte(whtCorrections.correctionDate, to),
				),
			);

		return [...billingRows, ...correctionRows].sort(compareScheduleRows);
	});
```

- [ ] **Step 6: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 7: Run the full report lib test suite once more**

Run: `pnpm vitest run src/features/reports/lib/wht-schedule.test.ts`
Expected: PASS.

- [ ] **Step 8: Do not commit.**

---

### Task 16: WHT Schedule report — UI

**Files:**
- Modify: `src/features/reports/components/wht-schedule-report.tsx`
- Modify: `src/features/reports/components/downloadable-wht-schedule.tsx`

**Interfaces:**
- Consumes: the extended `WhtScheduleRow` (Task 15).

- [ ] **Step 1: Add "Type" and "Status" columns to the on-screen table**

In `wht-schedule-report.tsx`:
- Bump `const COLUMN_COUNT = 8;` to `const COLUMN_COUNT = 10;`.
- Add two `<TableHead>`s after "Certificate No": `<TableHead className="w-[110px]">Type</TableHead>` and `<TableHead className="w-[150px]">Remittance Status</TableHead>`.
- Add corresponding `<TableCell>`s in the row map, after the certificate-no cell:

```tsx
<TableCell>
	{row.rowType === "billing" ? "Entered at billing" : "Correction entry"}
</TableCell>
<TableCell>
	{row.remittanceStatus === "already_remitted"
		? "Already remitted"
		: row.remittanceStatus === "pending"
			? "Pending remittance"
			: "-"}
</TableCell>
```
- Add two empty `<TableCell />` pairs to both the per-group subtotal row and the grand-total `<TableFooter>` row (they currently have 8 cells; make it 10, matching the new column count, same as the existing empty `<TableCell />` already used for the "Rate %" gap in those rows).
- The PDF export's per-row map (inside `PDFDownloadLink`'s `document` prop) must also pass `rowType`/`remittanceStatus` through — add them to the object literal built from `group.rows.map(...)`.

- [ ] **Step 2: Mirror the same two columns in the PDF**

In `downloadable-wht-schedule.tsx`:

Add two new style entries, right after `colCert: { flex: 1.4, fontSize: 9 },`:

```ts
	colType: { flex: 1, fontSize: 9 },
	colStatus: { flex: 1.3, fontSize: 9 },
```

Extend `WhtSchedulePdfRow`:

```ts
export type WhtSchedulePdfRow = {
	vendor: string;
	taxPin: string;
	invoiceNo: string;
	invoiceDate: string;
	grossAmount: string;
	rate: string;
	whtAmount: string;
	certificateNo: string;
	rowType: string;
	remittanceStatus: string;
};
```

In the table header `<View style={styles.tableHeader}>`, add after the `colCert` header:

```tsx
					<Text style={[styles.colType, styles.bold]}>Type</Text>
					<Text style={[styles.colStatus, styles.bold]}>Status</Text>
```

In the per-row `<View style={styles.row}>` map, add after `<Text style={styles.colCert}>{row.certificateNo}</Text>`:

```tsx
								<Text style={styles.colType}>{row.rowType}</Text>
								<Text style={styles.colStatus}>{row.remittanceStatus}</Text>
```

In the subtotal row (`styles.subtotalRow`), add after `<Text style={styles.colCert} />`:

```tsx
							<Text style={styles.colType} />
							<Text style={styles.colStatus} />
```

In the grand-totals row (`styles.totalsRow`), add after `<Text style={styles.colCert} />`:

```tsx
					<Text style={styles.colType} />
					<Text style={styles.colStatus} />
```

Back in `wht-schedule-report.tsx`, the `PDFDownloadLink`'s `document` prop builds each PDF row from `group.rows.map((row) => ({ ... }))` — add the same two fields there:

```tsx
											rowType: row.rowType === "billing" ? "Entered at billing" : "Correction entry",
											remittanceStatus:
												row.remittanceStatus === "already_remitted"
													? "Already remitted"
													: row.remittanceStatus === "pending"
														? "Pending remittance"
														: "-",
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Manual verification**

Run: `pnpm dev`, navigate to `/app/reports/finance/wht-schedule`, pick a date range spanning at least one correction created during Task 17's smoke test, and confirm both a billing row and a correction row render with the correct Type/Status labels, and the PDF export includes both columns.

- [ ] **Step 5: Do not commit.**

---

### Task 17: End-to-end manual verification

No files changed in this task — it is the final gate before handing the branch back for review, per this project's convention of testing the golden path and edge cases in the browser before calling frontend work complete.

- [ ] **Step 1: Run the full automated check suite**

Run: `pnpm typecheck && pnpm vitest run && pnpm lint`
Expected: all PASS.

- [ ] **Step 2: Start the app**

Run: `pnpm dev`

- [ ] **Step 3: Verify a `pending` correction**

Pick an existing posted bill with `wht_amount = 0` (or note its current balance). Go to `/app/wht-corrections/new`, add a line against that bill (category, rate, amount), leave status "Not yet remitted", submit. Confirm:
- The bill's row in `/app/bills` no longer shows the phantom overdue amount if it was previously fully paid gross (the `vw_invoices.net_payable` fix).
- The bill now appears in `/app/wht-remittances/new`'s outstanding list with the correction amount included in its WHT balance (the `vw_wht_balances` fix) — this is the "missed WHT entirely" case from the Review Focus list; it must appear even though the bill's own `wht_amount` was zero.

- [ ] **Step 4: Verify an `already_remitted` correction**

Create a second correction, status "Already remitted to KRA", pick a payment method (try `mpesa` to exercise the cash-equivalent-account path, and `bank` in a second pass to exercise the banking-entry path), submit. Confirm:
- It does **not** appear in `/app/wht-remittances/new`'s outstanding list.
- A banking entry exists (`bank` case only) — check `/app/bankings/postings` for a row tagged with today's/the remittance date.
- The referenced bill's `net_payable`/balance in `/app/bills` is reduced by the correction amount, same as the pending case.

- [ ] **Step 5: Verify deletion**

Delete one of the two corrections from `/app/wht-corrections`. Confirm the affected bill's balance and (for the pending one) the WHT remittance outstanding list revert to their pre-correction state.

- [ ] **Step 6: Verify the report**

Go to `/app/reports/finance/wht-schedule`, select a date range covering both corrections' `correctionDate` values, and confirm both appear as "Correction entry" rows with the right "Remittance Status", grouped into the correct rate band alongside any ordinary billing rows.

- [ ] **Step 7: Confirm nothing wrote to `bills`/`bill_items`**

Run: `psql "$DATABASE_URL" -c "SELECT id, updated_at FROM bills WHERE id IN ('<bill id 1>', '<bill id 2>');"`
Expected: `updated_at` is unchanged from before Task 17 Step 3 — the correction feature never touched the bill rows themselves.

- [ ] **Step 8: Do not commit.** Report back to the project owner for review of the working tree as-is.
