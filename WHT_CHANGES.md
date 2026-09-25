# Withholding Tax (WHT) on Bills — Browser Test Guide

Step-by-step browser walkthrough for the WHT feature: withholding entered per bill
line, split out as a separate liability when the bill posts, and remitted to KRA
through a dedicated remittance workflow.

> **Form change:** the per-line **Nature of Expense** dropdown has been removed.
> You now enter the **Rate %** directly; it pre-fills with **5** when you tick the
> WHT checkbox and is editable from there. The removed column's width went to
> **Amount** and **Description**.
>
> Because the nature of expense is no longer captured, the **WHT Schedule** report
> groups by **rate** (`Withheld at 5%`, `Withheld at 10%`) instead of by category.

---

## Contents

1. [Prerequisites](#1-prerequisites)
2. [Bill entry](#2-bill-entry)
3. [The journal split](#3-the-journal-split)
4. [Editing a bill](#4-editing-a-bill)
5. [Paying the vendor](#5-paying-the-vendor)
6. [Remitting to KRA](#6-remitting-to-kra)
7. [Certificate tracking](#7-certificate-tracking)
8. [Delete guards](#8-delete-guards)
9. [The WHT Schedule report](#9-the-wht-schedule-report)
10. [Permission gating](#10-permission-gating)
11. [Downstream reports](#11-downstream-reports)
12. [SQL verification](#12-sql-verification)
13. [Known limitations](#13-known-limitations)
14. [Rollback](#14-rollback)

---

## 1. Prerequisites

### 1.1 Schema

`gym_local` is **push-managed** — its `drizzle.__drizzle_migrations` table is empty,
so `pnpm db:migrate` would try to replay every migration from `0000` and fail at
`0019` on a pre-existing FK type mismatch. Use push plus the view SQL:

```bash
# Back up first — step two drops and recreates a view.
pg_dump -h localhost -p 5433 -U postgres -d gym_local -Fc \
  -f ~/gym_local_pre_wht_$(date +%Y%m%d_%H%M).dump

pnpm db:push

# push ignores `.existing()` views, so create them by hand:
sed 's|--> statement-breakpoint|;|' \
  src/drizzle/migrations/0093_wht_balance_views.sql > /tmp/wht_views.sql
psql -h localhost -p 5433 -U postgres -d gym_local -v ON_ERROR_STOP=1 -f /tmp/wht_views.sql
```

### 1.2 Permissions

`pnpm db:seed` runs **every** seeder (demo users, members, attendance). For just the
new permission keys:

```bash
npx tsx ./src/drizzle/seed/seed-permissions-only.ts
```

Only needed for non-admin roles — `userHasPermission` returns `true` for any user
whose `role` is `admin` (`src/lib/permissions/permission-queries.ts:54`). Required
before [section 10](#10-permission-gating).

### 1.2b Bind the account mappings — required

Postings resolve Accounts Payable, VAT Input and WHT Payable through
`ledger_account_mappings`, not by account name. Nothing posts until each role is
bound:

```bash
npx tsx ./src/drizzle/seed/seed-account-mappings-only.ts
```

Then open **Chart of Accounts › Account Mappings** and confirm all four roles read
**Configured**. A role left unmapped makes bills, payments, expenses and
remittances refuse to save with a message naming the role — by design, so a journal
never lands in a silently-invented account.

### 1.3 Confirm it landed

```bash
psql -h localhost -p 5433 -U postgres -d gym_local -c "
select 'new tables'              as check, count(*)||'/2' as got from information_schema.tables  where table_name in ('wht_remittances','wht_remittance_lines')
union all select 'bills cols',           count(*)||'/3' from information_schema.columns where table_name='bills'      and column_name like 'wht%'
union all select 'bill_items cols',      count(*)||'/4' from information_schema.columns where table_name='bill_items' and column_name like 'wht%'
union all select 'wht_category enum',    count(*)||'/1' from pg_type              where typname='wht_category'
union all select 'vw_invoices.net_payable', count(*)||'/1' from information_schema.columns where table_name='vw_invoices' and column_name='net_payable'
union all select 'vw_wht_balances',      count(*)||'/1' from pg_class             where relname='vw_wht_balances'
union all select 'ledger_account_mappings', count(*)||'/1' from information_schema.tables where table_name='ledger_account_mappings'
union all select 'new permissions',      count(*)||'/7' from permissions          where key like 'wht-%' or key='reports:wht-schedule' or key like 'ledger-account-mappings:%';"
```

All eight must read `n/n`. If `vw_invoices.net_payable` is `0/1`, the view SQL
didn't run.

> `wht_category` (column + enum) is retained in the database but no longer written
> by the app, so this check still expects it.

### 1.4 Regression — existing bills must be untouched

```bash
psql -h localhost -p 5433 -U postgres -d gym_local -c "
select invoice_no, total, wht_amount, net_payable, total_payment, balance, display_status
from vw_invoices order by invoice_no;"
```

Every pre-existing bill must show `wht_amount = 0.00`, `net_payable = total`, and
the **same** `balance` and `display_status` as before. If any changed, stop and
restore from the dump.

### 1.5 Vendor tax PINs

The schedule report shows the vendor PIN, and KRA needs it. Two of the three
vendors have none:

```bash
psql -h localhost -p 5433 -U postgres -d gym_local -c "
update vendors set tax_pin='P051234567A' where name='ABC Properties' and tax_pin is null;
update vendors set tax_pin='P051234567B' where name='Test Vendor'    and tax_pin is null;"
```

### 1.6 Automated checks

```bash
pnpm typecheck                                    # expect no output
npx vitest run --exclude '**/.kilo/**'            # expect 42 files / 367 tests
```

> The `--exclude` matters: a git worktree at `.kilo/worktrees/waiting-ink` contains
> a second copy of 38 test files, so a bare `pnpm test` reports 80 files / 690
> tests by running everything twice. Unrelated to this feature.

### 1.7 Start the app

```bash
pnpm dev     # http://localhost:3000
```

Log in as an **admin** for sections 2–9. The sidebar should now show
**WHT Remittances** beneath Payments.

---

## 2. Bill entry

### 2.1 Baseline — VAT-exclusive line

Go to **`/app/bills/new`**.

| Field | Value |
|---|---|
| Vendor | Clyde Water Services |
| Invoice Date | today |
| Terms | Net 30 |
| Invoice# | `WHT-001` |

Line 1 — account: any expense account · description: `Audit fees` ·
**Amount: `10000`** · Tax: `Exclusive` · then tick **WHT**.

**Check as you go:**

- The line columns are: Account · Description · Amount · Tax · **WHT** · **Rate %** · **WHT Amount** · (delete).
- There is **no Nature of Expense dropdown**.
- **Amount** and **Description** are visibly wider than before.
- With WHT unticked, **Rate %** shows `—`.
- Ticking **WHT** reveals Rate % **already filled with `5`**.
- **WHT Amount** shows `500.00` immediately.

The footer must read exactly:

| Row | Value |
|---|---|
| Subtotal (excl. VAT) | 10,000.00 |
| VAT | 1,600.00 |
| **Total** | **11,600.00** |
| WHT Withheld | 500.00 |
| **Net Payable to Vendor** | **11,100.00** |

Submit. In the bill list the row shows **Amount** 11,600 · **WHT Withheld** 500
(amber badge) · **Net Payable** 11,100.

### 2.2 The base excludes VAT — the subtle one

New bill `WHT-002`, same vendor. **Amount `11600`**, Tax **Inclusive**, tick WHT
(rate pre-fills 5).

**WHT Amount must still be `500.00`** — not 580. Totals identical to 2.1:
Subtotal 10,000 / VAT 1,600 / Total 11,600 / Net 11,100.

This proves WHT is withheld on the consideration for the supply, not on the VAT
charged on it.

### 2.3 Overriding the rate (non-resident vendor)

Still on `WHT-002`, change **Rate %** from `5` to `20`.

- WHT Amount → `2,320.00`
- Net Payable → `9,280.00`
- Click into another field and back — **the 20 stays**. The pre-fill happens only
  when you tick the checkbox, so it never overwrites what you typed.

Now untick **WHT**, then tick it again → the rate resets to the default `5`.
Leave it at 5 and save.

### 2.4 Mixed lines

New bill `WHT-003`, vendor **ABC Properties**:

- **Line 1** — Amount `50000`, Tax `None`, tick WHT, change Rate to `10`
  → WHT Amount `5,000.00`
- **Add Line** → **Line 2** — Amount `2000`, Tax `None`, leave WHT **unticked**
  → WHT Amount `0.00`, Rate shows `—`

Footer: Subtotal 52,000 / VAT 0 / **Total 52,000** / WHT 5,000 /
**Net Payable 47,000**.

Save.

### 2.5 Validation

On a new bill, tick WHT on a line and then **clear the Rate field**. Submit:

- → **"WHT rate is required"**

Enter `150`, submit:

- → **"WHT rate must be between 0 and 100"**

Enter a rate that would withhold more than the bill total (e.g. `100` on a
VAT-exclusive line — WHT 10,000 against a total of 11,600 still passes; to trip the
server guard you would need WHT above the total, which the 0–100 rule prevents on a
single line). The server guard exists as a backstop and returns
**"Withholding tax cannot exceed the bill total."**

There is **no** "Select the nature of expense" message any more — that rule was
removed with the dropdown.

---

## 3. The journal split

Go to **`/app/journal-entries`** and open the entry for `WHT-001`.

| Account | Debit | Credit |
|---|---|---|
| *(your expense account)* | 10,000.00 | |
| vat input | 1,600.00 | |
| accounts payable | | **11,100.00** |
| **wht payable** | | **500.00** |

Both sides total **11,600.00**. The debit side is unchanged from before this
feature — **only the credit side splits**: the vendor is owed the total less the tax
withheld on their behalf, and the withheld portion becomes a liability to KRA.

`WHT Payable` is resolved through the **account mapping**, not by name, so this
posting depends on that role being bound (section 1.2b). Confirm the account it
resolves to:

```bash
psql -h localhost -p 5433 -U postgres -d gym_local -c "
select r.role, a.code, a.name, a.type, a.is_posting
from ledger_account_mappings r join ledger_accounts a on a.id = r.account_id
order by r.role;"
```

Expect `wht_payable` bound to **`2202 WHT Payable`**, a posting `liability` nested
under `2200 Tax Payables` beside `2201 VAT Output`.

> **Renaming the account is safe.** Resolution is by the mapped id, so a rename no
> longer creates a duplicate or strands the balance — which is exactly what the old
> name-based lookup did. To point a role at a different account, change it on the
> Account Mappings page rather than renaming the account.

---

## 4. Editing a bill

Open `WHT-001` → **Edit** (offered only while the bill has no payments **and** none
of its withholding has been remitted — the server refuses an edit that would drop
the withheld amount below what was already paid over to KRA).

- The saved rate `5` is shown — **and is not overwritten** by the default.
- Change the rate to `10`, save.
- Re-open the journal entry: accounts payable credit `10,600.00`, wht payable
  credit `1,600.00`, and **no duplicate entry** (the old one is deleted and
  reposted).

Set it back to `5` and save.

---

## 5. Paying the vendor

This is the headline correctness fix. Bill list → `WHT-001` → **Make Payment**.

1. The bill row shows **Balance 11,100.00** — not 11,600.
2. Tick it, enter `11600`, submit → rejected with
   **"Payment amount exceeds bill balance"**.
3. Enter `11100`, submit.

The bill list now shows `WHT-001` as **Paid** with balance `0`, and **Make Payment
disappears** from its row menu. The vendor has been settled in full; the 500 is owed
to KRA, not to them.

> Payments became WHT-aware without any change to their *balance* logic:
> `payments.api.ts` reads `vw_invoices.balance`, so correcting that view was
> enough. It was later edited for a separate reason — to resolve Accounts Payable
> through the account mapping instead of by name.

---

## 6. Remitting to KRA

Go to **`/app/wht-remittances`** → empty state → **Add Remittance**.

Note there is **no vendor selector**: one payment to KRA covers every vendor for the
period, which is the deliberate structural difference from a bill payment.

The table lists every bill with WHT outstanding — expect `WHT-001` (500),
`WHT-002` (500) and `WHT-003` (5,000), with header **Total Outstanding 6,000.00**.

| Field | Value |
|---|---|
| Remittance Date | today |
| Payment Method | Bank |
| Reference | `PRN-TEST-001` |
| Bank | your bank account |
| Description | `WHT for testing` |

1. Tick `WHT-001` and `WHT-003`.
2. Tick **"Remit the full outstanding WHT on all selected bills"** → amounts fill to
   `500` and `5,000`; footer total **5,500.00**.
3. Type `9999` into one of them → **"Amount exceeds the WHT balance"**.
4. Put it back and submit.

Then verify:

- The list shows remittance **#1**, amount **5,500.00**.
- **View** → each line names **its own vendor and PIN**, plus WHT Withheld, Balance
  Before, Amount Remitted, and a total of 5,500.
- **`/app/bankings/postings`** → a credit of 5,500.
- Its journal entry: **DR wht payable 5,500 / CR bank 5,500** — settling the
  liability raised in [section 3](#3-the-journal-split).

### 6.1 Partial remittance

New remittance, reference `PRN-TEST-002`. `WHT-002` should be the only row left,
balance `500`. Enter `200` and submit.

Start a third remittance — `WHT-002` now shows balance **300**.

### 6.2 Deleting a remittance restores the balance

Delete remittance **#2** from the list. `WHT-002`'s outstanding WHT returns to
**500** — the lines cascade with the header, so the balance is restored rather than
stranded.

---

## 7. Certificate tracking

Bill list → `WHT-001` → **WHT Certificate**.

The action appears only when the bill withheld tax, and it is **still available even
though the bill is paid** and Edit is gone — which is the point, since certificates
arrive from iTax well after payment.

Enter `CERT-001` and an issued date, save. Confirm:

```bash
psql -h localhost -p 5433 -U postgres -d gym_local -c "
select invoice_no, wht_certificate_no, wht_certificate_issued_date from bills where invoice_no='WHT-001';"
```

Check the guard too: the action is **absent** on any bill with no WHT. (Forcing the
call returns *"No withholding tax was deducted on this bill"*.)

---

## 8. Delete guards

| Bill | State | Expected |
|---|---|---|
| `WHT-001` | has a payment | **Edit and Delete both hidden** |
| `WHT-003` | WHT remitted, no payment | Delete visible, but fails with **"Bill has withholding tax remitted against it"** |

The second is the important one: without that guard the delete would fail on the
foreign key and surface as an unexplained error.

---

## 9. The WHT Schedule report

**Finance Reports** → **WHT Schedule** card → date range covering your test bills →
**Preview**.

- Rows are grouped by rate: **`Withheld at 5%`** and **`Withheld at 10%`**, each
  followed by **`Subtotal at 5%`** / **`Subtotal at 10%`**, then a grand **Total**.
- Columns: Vendor · PIN · Bill Ref · Bill Date · **Gross Amount (excl. VAT)** ·
  Rate % · WHT Amount · Certificate No.
- `WHT-001` shows Gross **10,000.00** — the ex-VAT base the rate was applied to —
  and Certificate `CERT-001` from section 7.
- Rates differing only in stored precision (`5` vs `5.00`) fall in **one** band.
- **Export PDF** → landscape A4, same grouping, subtotals and total present.
- Narrow the range to exclude everything → empty state, not a crash.

---

## 10. Permission gating

Admins bypass every check, so this needs a non-admin. Grant the `registar` role
view-only access:

```bash
psql -h localhost -p 5433 -U postgres -d gym_local -c "
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r, permissions p
where r.name='registar' and p.key in ('wht-remittances:view','bills:view')
on conflict do nothing;"
```

Assign a non-admin user to `registar` and log in as them:

- **WHT Remittances** appears in the sidebar and the list loads.
- **Add Remittance** is hidden (no `wht-remittances:create`).
- Visiting `/app/wht-remittances/new` directly is refused by `beforeLoad`.
- Edit and Delete are hidden in the row menu.
- The **WHT Schedule** card is hidden on Finance Reports (no `reports:wht-schedule`).

---

## 11. Downstream reports

These inherit the fix without any code change of their own:

| Report | Expected |
|---|---|
| **Trial Balance** | `wht payable` carries a credit balance equal to unremitted WHT |
| **Balance Sheet** | the same figure under liabilities |
| **Invoices Report** (`all`) | Amount is **gross**; Balance is **net of WHT** — the gap is the withheld tax, not a discrepancy |
| **Ageing / Overdue** | computed on net balances |
| **Dashboard overdue stat** | computed on net balances |

---

## 12. SQL verification

Set up once:

```bash
cd "$(git rev-parse --show-toplevel)"
export PGPASSWORD=$(grep -m1 "^DATABASE_URL=postgresql://postgres" .env | sed 's|.*postgres:\([^@]*\)@.*|\1|')
alias gq='psql -h localhost -p 5433 -U postgres -d gym_local'
```

### 12.1 Core reconciliation — every flag must be `t`

```sql
select b.invoice_no,
       b.total, b.wht_amount,
       v.net_payable, v.total_payment, v.balance, v.display_status,
       w.remitted_amount, w.wht_balance,
       (b.total - b.wht_amount = v.net_payable)              as net_ok,
       (v.net_payable - v.total_payment = v.balance)         as balance_ok,
       (coalesce(w.wht_amount,0) - coalesce(w.remitted_amount,0)
          = coalesce(w.wht_balance,0))                       as wht_ok
from bills b
  join vw_invoices v on v.id = b.id
  left join vw_wht_balances w on w.id = b.id
order by b.invoice_no;
```

### 12.2 Line WHT equals rate × ex-VAT base

Proves the server recomputed the amount rather than trusting the browser.

```sql
select b.invoice_no, bi.sub_total, bi.wht_rate, bi.wht_amount,
       round(bi.sub_total * bi.wht_rate / 100, 2) as expected,
       (bi.wht_amount = round(bi.sub_total * bi.wht_rate / 100, 2)) as ok
from bill_items bi join bills b on b.id = bi.bill_id
where bi.wht_applicable order by b.invoice_no;
```

### 12.3 Bill total equals the sum of its lines

```sql
select b.invoice_no, b.wht_amount as bill_wht, sum(bi.wht_amount) as lines_wht,
       (b.wht_amount = sum(bi.wht_amount)) as ok
from bills b join bill_items bi on bi.bill_id = b.id
group by b.id, b.invoice_no, b.wht_amount order by b.invoice_no;
```

### 12.4 Every WHT journal balances

```sql
select je.source, je.reference,
       sum(case when jl.dc='debit'  then jl.amount else 0 end) as dr,
       sum(case when jl.dc='credit' then jl.amount else 0 end) as cr,
       (sum(case when jl.dc='debit' then jl.amount else -jl.amount end) = 0) as balanced
from journal_entries je join journal_lines jl on jl.journal_entry_id = je.id
where je.source in ('bills','wht remittance')
group by je.id, je.source, je.reference order by je.source, je.reference;
```

### 12.5 The strongest check — ledger agrees with the view

```sql
select (select sum(case when jl.dc='credit' then jl.amount else -jl.amount end)
        from journal_lines jl join ledger_accounts la on la.id = jl.account_id
        where lower(la.name)='wht payable')                    as ledger_balance,
       (select coalesce(sum(wht_balance),0) from vw_wht_balances) as view_balance;
```

**These two must be equal.** If they diverge, a bill or remittance posted without
its counterpart.

### 12.6 No over-remittance

```sql
select invoice_no, wht_amount, remitted_amount, wht_balance
from vw_wht_balances where wht_balance < 0;
```

**Must return zero rows.**

---

## 13. Known limitations

1. **WHT is recognised at bill-posting time**, not at payment. Kenyan law deducts on
   payment, so the liability here arises earlier than the statutory trigger.
   Deliberate design decision — confirm it matches how you file.
2. **The default rate is unverified.** `src/features/bills/lib/wht-constants.ts`
   sets `DEFAULT_WHT_RATE = 5` behind a `⚠️ CONFIRM BEFORE FILING ⚠️` comment,
   pinned by a test. 5% is the common resident professional/management/training
   rate; rent and contractual fees differ, and non-residents are much higher.
   **Verify against the current Income Tax Act third schedule, and override per
   line wherever it does not apply.**
3. **The nature of expense is no longer recorded.** The `wht_category` column and
   enum remain in the database but nothing writes them. If KRA filing needs the
   nature rather than just the rate, this has to come back — either as the dropdown
   or derived some other way.
4. **Account roles must be bound before anything posts.** Accounts Payable, VAT
   Input, WHT Payable and Opening Balance Equity resolve through
   `ledger_account_mappings`. A role left unmapped makes the relevant save refuse
   with a message naming it. There is no lazy account creation any more — on a
   fresh install an admin creates the account in the chart of accounts and maps it.
   VAT Input is resolved only when a document actually carries VAT, so zero-VAT
   bills and expenses post without it.

5. **`wht_remittances` has no `payment_method` column.** Editing a remittance shows
   M-Pesa as "Cash" and cheque as "Bank". The crediting account *is* stored so the
   journal is identical — cosmetic only.
6. **`display_status` reads `paid`** once the vendor is settled, even with WHT still
   outstanding. Correct: the vendor is paid, and `vw_wht_balances` tracks KRA.
7. **Fresh provisioning from migrations is broken** at `0019`
   (`mpesa_stk_requests.invoice_id` integer vs `customer_invoices.id` varchar).
   Pre-existing and unrelated, but it is why `db:push` is used here.

---

## 14. Rollback

Full restore (simplest):

```bash
pg_restore -h localhost -p 5433 -U postgres -d gym_local --clean --if-exists \
  ~/gym_local_pre_wht_YYYYMMDD_HHMM.dump
```

Schema-only:

```bash
psql -h localhost -p 5433 -U postgres -d gym_local -v ON_ERROR_STOP=1 -c "
DROP VIEW  IF EXISTS vw_wht_balances;
DROP TABLE IF EXISTS wht_remittance_lines;
DROP TABLE IF EXISTS wht_remittances;
ALTER TABLE bill_items DROP COLUMN IF EXISTS wht_applicable,
                       DROP COLUMN IF EXISTS wht_category,
                       DROP COLUMN IF EXISTS wht_rate,
                       DROP COLUMN IF EXISTS wht_amount;
ALTER TABLE bills DROP COLUMN IF EXISTS wht_amount,
                  DROP COLUMN IF EXISTS wht_certificate_no,
                  DROP COLUMN IF EXISTS wht_certificate_issued_date;
DROP TYPE IF EXISTS wht_category;
DROP VIEW IF EXISTS vw_invoices CASCADE;"

# restore the previous vw_invoices definition
sed -n '/^CREATE VIEW vw_invoices/,/^ORDER BY b.invoice_date DESC, b.invoice_no DESC;/p' \
  src/drizzle/migrations/0091_capture_and_extend_reporting_views.sql \
  | psql -h localhost -p 5433 -U postgres -d gym_local -v ON_ERROR_STOP=1 -f -
```

You would also revert the code, since it references the dropped columns.

---

## The five that matter most

Short on time? Do these:

| # | Test | Proves |
|---|---|---|
| [1.4](#14-regression--existing-bills-must-be-untouched) | Existing bills unchanged | No regression |
| [2.2](#22-the-base-excludes-vat--the-subtle-one) | Inclusive-VAT line still withholds 500 | Correct WHT base |
| [3](#3-the-journal-split) | Credit side splits and balances | Correct accounting |
| [5](#5-paying-the-vendor) | Paying net marks it paid; gross is rejected | The core fix |
| [12.5](#125-the-strongest-check--ledger-agrees-with-the-view) | Ledger balance = view balance | Ledger and operations agree |
