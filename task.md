### CONTEXT

You are working on the payroll module of a gym management application built with TypeScript, React, TanStack Router/Start, Drizzle ORM, and PostgreSQL. You are building the Statutory Remittance section of the payroll period detail page, along with a Journal Summary section that is currently missing from the UI entirely. The backend function `postStatutoryRemittanceJournal` already exists and works correctly — it accepts a `remittedItems` array (one or more category remittances submitted together in a single bulk transaction) plus a single shared `remittanceDate` and `remittanceAccountId` for the whole submission. Do not modify this backend function. The data source for both sections is the `journalSummary` query, which returns:

```typescript
{
  recognitionJournal: { id, postedAt, totalDebits, totalCredits } | null
  disbursementJournal: { id, postedAt, amount, disbursementAccount: { id, code, name, type } } | null
  remittanceJournals: Array<{ id, postedAt, itemsPosted, totalAmount }>
  remittanceCompletionStatus: {
    items: Array<{ type, requiredAmount, remittedAmount, outstandingAmount, isComplete }>
    isFullyRemitted: boolean
  }
  allJournalsComplete: boolean
}
```

### BEFORE WRITING ANYTHING

Open `/src/features/payroll/components/payroll-period/payroll-period-detail.tsx` and inspect the existing components inside it (disbursement section, slip table, bonus/deduction sections, etc.). Do not modify any existing component in this file — only add the two new components alongside them. While inspecting, note any structural or styling inconsistencies you notice between the existing components and report them at the end of your work, but do not fix them unless explicitly asked.
Study the project's existing design tokens, color variables, spacing scale, and component primitives (buttons, inputs, selects, checkboxes, badges/pills, cards) already used elsewhere in this file and in the broader payroll module. Do not introduce new colors, spacing values, or one-off styles — every visual choice in both new components must reuse an existing token or pattern already established in the codebase. If the codebase has a status-pill component (used anywhere for "active"/"paid"/"approved" type badges), reuse it for the "Paid"/"Complete" states rather than building a new badge style.

### PART 1 — JOURNAL SUMMARY SECTION

This section is currently entirely missing from the UI and needs to be built from scratch. It gives HR a single, scannable overview of all journal activity for the period, sitting above the Statutory Remittance section.
Layout: three or four compact cards/rows (match whatever card pattern already exists in this file for similarly-sized summary stats), one per journal type:

1. **Payroll Recognition** — show `recognitionJournal.postedAt` (formatted date) and confirm `totalDebits === totalCredits` (it always should be, by design, but display both figures so the balance is visible, e.g. "DR/CR KES 10,800.00"). If `recognitionJournal` is null, show a clear "Not yet posted" state instead of blank/empty content.
2. **Salary Disbursement** — show `disbursementJournal.postedAt`, `disbursementJournal.amount`, and `disbursementJournal.disbursementAccount.name` (e.g. "Disbursed KES 8,950.00 via Bank — Standard Chartered"). If `disbursementJournal` is null, show "Not yet recorded".
3. **Statutory Remittance** — show a compact summary derived from remittanceCompletionStatus: the same "X of 6 statutory items remitted" phrasing and progress indicator used in Part 2 below (this can be a smaller/condensed version of the same progress bar, or simply link/scroll down to the full remittance section — your choice, but keep it visually consistent with the other two cards in this row).
4. **Overall status** — a single indicator reflecting `allJournalsComplete`: a clear "All journals complete" success state when true, or "X journal(s) pending" when false, listing which of the three are still outstanding.

This section should read clearly at a glance without needing to scroll into the detailed remittance checklist below it — it's the executive summary; Part 2 is the operational detail and action area.

### PART 2 — STATUTORY REMITTANCE SECTION

A page-section component (not a modal), rendered below the Journal Summary section, showing all six statutory categories as a checklist with bulk submission.
Section header: Title "Statutory Remittance" with a subtitle showing progress, e.g. "3 of 6 statutory items remitted" — derive the "3 of 6" count from `remittanceCompletionStatus.items.filter(i => i.isComplete).length` out of 6. Include a horizontal progress bar reflecting that same fraction, matching whatever progress-bar component/pattern already exists in the codebase if one does; if none exists, build the simplest possible bar using only existing color tokens (do not invent a new accent color for it).
Per-category row, one per item in `remittanceCompletionStatus.items`:

- If `isComplete === true`: render a read-only row — category name and code description (e.g. "PAYE — Pay As You Earn (KRA)"), and on the right side a "Paid" pill plus the remittance detail line underneath the category name showing the date and reference it was remitted on. To find this detail, search remittanceJournals for the journal entry whose itemsPosted array contains this category type, and use that journal's posted date and reference. If a category has requiredAmount === 0 (nothing was ever owed for it this period, e.g. PAYE or HELB with zero liability), render it as complete but with a distinct label like "Nothing due" instead of a fabricated "Paid" pill with no real remittance behind it — do not invent a fake paid state for a category that was never actually owed.
- If `isComplete === false`: render an interactive row with:

- A checkbox on the left, next to the category name and its outstandingAmount shown as context text (e.g. "KES 13,680 outstanding")
- When unchecked: the rest of the row's input fields are disabled/greyed out
- When checked: two fields activate inline within that row — an amount input (numeric, pre-filled with the category's outstandingAmount, but editable to support partial remittance, validated client-side to not exceed outstandingAmount), and an optional reference number text input

Shared fields below the checklist, applying to the whole bulk submission:

A single remittance date picker (defaults to today), shared across every checked item in this submission
A single GL account select (populated from active asset ledger accounts — reuse whatever account-select component/query is already used elsewhere on this page, e.g. wherever the disbursement account is selected), shared across the entire submission since the backend currently only supports one `remittanceAccountId` per submission, not a per-row account
A single submit button, e.g. "Record Remittance", disabled if zero categories are currently checked

On submit:

- Build the `remittedItems` array from only the checked categories, each as `{ type: category, amountRemitted: <value from that row's amount input> }`
- Call `postStatutoryRemittanceJournal` with the shared `remittanceDate`, the single shared `remittanceAccountId`, and the `remittedItems` array
- On success: clear all checkboxes, refresh the `journalSummary` query so both the Journal Summary section and the checklist reflect the new state, show a success message summarizing what was recorded (e.g. "Recorded remittance for AHL, NITA — KES 14,580 total")
- On failure: show the returned error message inline on the form (e.g. an amount exceeding outstanding balance), do not clear the form, so the user can correct and resubmit

Reference number field: the current `postStatutoryRemittanceJournal` payload shape does not include a per-item reference number field in what has been shown to you — check whether the actual schema (`statutoryRemittanceJournalSchema`) supports it anywhere (e.g. as part of notes or a dedicated field). If it does, wire it through. If it does not, render the field in the UI as described, but flag clearly in your response that it is currently a no-op input not yet wired to anything, and ask before adding new backend support for it, since that would mean modifying the backend schema and function — out of scope unless confirmed.

### WHAT NOT TO DO

- Do not modify `postStatutoryRemittanceJournal` or its Zod schema unless the reference number question above requires explicit confirmation first.
- Do not modify any other component already in `payroll-period-detail.tsx`.
- Do not introduce a modal for either section — both must render as inline page sections.
- Do not invent new colors or spacing — match existing design tokens exactly.

### AFTER BUILDING

Report: (1) whether the reference number field needed backend changes and what you decided, (2) any structural/styling inconsistencies noticed in the existing components during inspection, (3) confirmation that the Journal Summary section correctly reflects all three journal states including the "not yet posted" / "not yet recorded" empty states.
