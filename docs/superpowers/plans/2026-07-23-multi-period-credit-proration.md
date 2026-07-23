# Multi-Period Credit Proration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prorate a membership credit note over every period purchased by the originating payment.

**Architecture:** Keep the calculation in the existing pure `computeSuggestedCreditAmount` helper, but make its denominator explicitly represent the total purchased duration. The eligibility service derives that duration from the authoritative plan duration and `payment.numberOfPeriods`; no schema or receipt-flow changes are required.

**Tech Stack:** TypeScript, Vitest, Big.js, date-fns, Drizzle ORM

## Global Constraints

- The member-access and receipt-eligibility review suggestion is out of scope.
- Use `membershipPlan.duration * payment.numberOfPeriods` as the proration denominator.
- Preserve the existing cap at `priceCharged`.
- Do not change the database schema.
- Follow the repository's tab indentation and double-quote formatting conventions.

---

### Task 1: Correct Multi-Period Suggested Credit

**Files:**
- Modify: `src/features/credit-notes/lib/eligibility.test.ts`
- Modify: `src/features/credit-notes/lib/eligibility.ts`

**Interfaces:**
- Consumes: `payment.numberOfPeriods: number`, `membership.membershipPlan.duration: number`
- Produces: `computeSuggestedCreditAmount({ priceCharged, totalDurationDays, unusedDays }): { dailyRate: string; suggestedAmount: string }`

- [ ] **Step 1: Write the failing multi-period test**

Add this test inside the existing `describe("computeSuggestedCreditAmount", ...)` block in `src/features/credit-notes/lib/eligibility.test.ts`:

```ts
	it("prorates the charge over every purchased period", () => {
		const result = computeSuggestedCreditAmount({
			priceCharged: "6000.00",
			planDurationDays: 30,
			// @ts-expect-error RED: production does not accept the total purchased duration yet.
			totalDurationDays: 60,
			unusedDays: 30,
		});
		expect(result.dailyRate).toBe("100.00");
		expect(result.suggestedAmount).toBe("3000.00");
	});
```

Do not change the three existing tests or production code yet. The temporary legacy `planDurationDays` property makes the old implementation calculate against 30 days, while the expected new interface supplies 60 total days. This ensures RED is an assertion failure rather than a division-by-undefined error.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm test src/features/credit-notes/lib/eligibility.test.ts
```

Expected: FAIL because `dailyRate` is `"200.00"` instead of `"100.00"` and/or `suggestedAmount` is `"6000.00"` instead of `"3000.00"`. This proves the old helper ignores the total purchased duration.

- [ ] **Step 3: Pass total purchased duration from eligibility**

In `checkCreditNoteEligibility` within `src/features/credit-notes/lib/eligibility.ts`, replace the helper call with:

```ts
	const { dailyRate, suggestedAmount } = computeSuggestedCreditAmount({
		priceCharged,
		totalDurationDays: membership.membershipPlan.duration * payment.numberOfPeriods,
		unusedDays,
	});
```

Then update the pure helper's comment, parameter name, type, and calculation:

```ts
// dailyRate = priceCharged / totalDurationDays; suggestedAmount = dailyRate ×
// unusedDays, capped at priceCharged (never suggest crediting more than what was
// actually charged). totalDurationDays covers every period purchased by the
// originating payment. Extracted as a pure function so the capping/rounding math
// is unit-testable without a DB connection.
export function computeSuggestedCreditAmount({
	priceCharged,
	totalDurationDays,
	unusedDays,
}: {
	priceCharged: string;
	totalDurationDays: number;
	unusedDays: number;
}) {
	const dailyRateBig = toBig(priceCharged).div(totalDurationDays);
	const rawSuggested = dailyRateBig.times(unusedDays);
	const cappedSuggested = rawSuggested.gt(toBig(priceCharged)) ? toBig(priceCharged) : rawSuggested;

	return {
		dailyRate: toDecimalString(dailyRateBig),
		suggestedAmount: toDecimalString(cappedSuggested),
	};
}
```

Finally, update all four test calls to use only the new property. The new test becomes:

```ts
	it("prorates the charge over every purchased period", () => {
		const result = computeSuggestedCreditAmount({
			priceCharged: "6000.00",
			totalDurationDays: 60,
			unusedDays: 30,
		});
		expect(result.dailyRate).toBe("100.00");
		expect(result.suggestedAmount).toBe("3000.00");
	});
```

For each of the three pre-existing tests, rename `planDurationDays` to `totalDurationDays` without changing its numeric value.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
pnpm test src/features/credit-notes/lib/eligibility.test.ts
```

Expected: all tests in `eligibility.test.ts` PASS, including the new two-period case and the existing single-period, cap, precision, VAT-ratio, and VAT-split cases.

- [ ] **Step 5: Run type and formatting verification**

Run:

```bash
pnpm typecheck
pnpm exec prettier --check src/features/credit-notes/lib/eligibility.ts src/features/credit-notes/lib/eligibility.test.ts
git diff --check
```

Expected: TypeScript exits successfully, Prettier reports both files formatted, and `git diff --check` emits no errors.

- [ ] **Step 6: Commit the implementation**

```bash
git add src/features/credit-notes/lib/eligibility.ts src/features/credit-notes/lib/eligibility.test.ts
git commit -m "prorate credits across purchased periods"
```
