# Payment Post-Commit Dispatch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve a successful bill-payment result when post-commit activity logging or Inngest dispatch fails.

**Architecture:** Add a small payment-specific helper that executes named post-commit tasks independently with `Promise.allSettled`, reports each rejection, and never throws. Call it after the existing database transaction so only transaction failures reach the payment failure response.

**Tech Stack:** TypeScript, Vitest, TanStack Start server functions, Drizzle ORM, Inngest.

## Global Constraints

- Keep the payment transaction and its rollback behavior unchanged.
- Never convert a post-commit logging or event-dispatch failure into a failed payment response.
- Attempt both post-commit operations exactly once even if one rejects.
- Do not add an outbox schema, migration, worker, or retry policy in this fix.
- Keep changes limited to the payment post-commit boundary and focused tests.

---

### Task 1: Isolate post-commit payment operations

**Files:**

- Create: `src/features/payments/services/payment-post-commit.ts`
- Create: `src/features/payments/services/payment-post-commit.test.ts`
- Modify: `src/features/payments/services/payments.api.ts:219-324`

**Interfaces:**

- Produces: `runPaymentPostCommitTasks(tasks, reportError?) => Promise<void>`.
- `tasks` is `readonly { name: string; run: () => void | Promise<void> }[]`.
- `reportError` receives `(message: string, error: unknown)` and defaults to `console.error`.
- `createPayment` supplies the existing `logActivity` and `inngest.send` calls as named task factories.

- [x] **Step 1: Write the failing regression tests**

Create `src/features/payments/services/payment-post-commit.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { runPaymentPostCommitTasks } from "./payment-post-commit";

describe("runPaymentPostCommitTasks", () => {
	it("resolves and attempts event dispatch when activity logging rejects", async () => {
		const attempts: string[] = [];
		const errors: string[] = [];

		await expect(
			runPaymentPostCommitTasks(
				[
					{
						name: "activity log",
						run: async () => {
							attempts.push("activity log");
							throw new Error("activity unavailable");
						},
					},
					{
						name: "invoice status event",
						run: async () => {
							attempts.push("invoice status event");
						},
					},
				],
				(message) => errors.push(message)
			)
		).resolves.toBeUndefined();

		expect(attempts).toEqual(["activity log", "invoice status event"]);
		expect(errors).toEqual(["Post-commit payment activity log failed"]);
	});

	it("resolves when invoice-status dispatch rejects", async () => {
		const attempts: string[] = [];
		const errors: string[] = [];

		await expect(
			runPaymentPostCommitTasks(
				[
					{
						name: "activity log",
						run: async () => {
							attempts.push("activity log");
						},
					},
					{
						name: "invoice status event",
						run: async () => {
							attempts.push("invoice status event");
							throw new Error("inngest unavailable");
						},
					},
				],
				(message) => errors.push(message)
			)
		).resolves.toBeUndefined();

		expect(attempts).toEqual(["activity log", "invoice status event"]);
		expect(errors).toEqual(["Post-commit payment invoice status event failed"]);
	});
});
```

The production mutation these tests catch is replacing `Promise.allSettled` with a rejecting aggregate or directly awaiting either post-commit operation.

- [x] **Step 2: Run the test and verify RED**

Run:

```bash
pnpm test src/features/payments/services/payment-post-commit.test.ts
```

Expected: FAIL because `./payment-post-commit` and `runPaymentPostCommitTasks` do not exist.

- [x] **Step 3: Implement the non-throwing dispatcher**

Create `src/features/payments/services/payment-post-commit.ts`:

```ts
type PaymentPostCommitTask = {
	name: string;
	run: () => void | Promise<void>;
};

type ReportPostCommitError = (message: string, error: unknown) => void;

export async function runPaymentPostCommitTasks(
	tasks: readonly PaymentPostCommitTask[],
	reportError: ReportPostCommitError = console.error
) {
	const results = await Promise.allSettled(tasks.map(({ run }) => Promise.resolve().then(run)));

	results.forEach((result, index) => {
		if (result.status === "rejected") {
			reportError(`Post-commit payment ${tasks[index]!.name} failed`, result.reason);
		}
	});
}
```

Using `Promise.resolve().then(run)` converts both synchronous throws and rejected promises into settled rejections while allowing every task to start.

- [x] **Step 4: Wire the helper into `createPayment`**

Import the helper:

```ts
import { runPaymentPostCommitTasks } from "@/features/payments/services/payment-post-commit";
```

Replace the two direct post-transaction awaits with:

```ts
await runPaymentPostCommitTasks([
	{
		name: "activity log",
		run: () =>
			logActivity({
				data: {
					action: id ? "update payment" : "create payment",
					userId,
					description: `${id ? "Updated" : "Created"} payment no ${paymentNo}`,
				},
			}),
	},
	{
		name: "invoice status event",
		run: () =>
			inngest.send({
				name: "app/bills.update.invoice.status",
				data: {
					paidInvoiceIds: paidBills.map((bill) => bill.billId),
				},
			}),
	},
]);

return success(undefined);
```

The helper must remain after the transaction and before the success return. It must not be moved into the transaction or allowed to throw into the outer catch.

- [x] **Step 5: Run focused tests and verify GREEN**

Run:

```bash
pnpm test src/features/payments/services/payment-post-commit.test.ts
```

Expected: 2 tests PASS.

- [x] **Step 6: Run static and full verification**

Run:

```bash
pnpm typecheck
pnpm exec prettier --check src/features/payments/services/payment-post-commit.ts src/features/payments/services/payment-post-commit.test.ts src/features/payments/services/payments.api.ts docs/superpowers/plans/2026-07-26-payment-post-commit-dispatch.md
git diff --check
pnpm test
```

Expected: TypeScript, formatting, diff validation, and all Vitest tests pass. Existing sandbox-only Nitro `listen EPERM` warnings may appear, but Vitest must exit with code 0 and report zero failed tests.

- [x] **Step 7: Commit the focused fix**

```bash
git add docs/superpowers/plans/2026-07-26-payment-post-commit-dispatch.md src/features/payments/services/payment-post-commit.ts src/features/payments/services/payment-post-commit.test.ts src/features/payments/services/payments.api.ts
git commit -m "preserve payment success after post-commit failures"
```

---

### Task 2: Review the resolved finding

**Files:**

- Review: `src/features/payments/services/payment-post-commit.ts`
- Review: `src/features/payments/services/payment-post-commit.test.ts`
- Review: `src/features/payments/services/payments.api.ts`

**Interfaces:**

- Consumes: Task 1's committed diff and verification output.
- Produces: confirmation that the still-valid finding is resolved without outbox infrastructure or unrelated changes.

- [ ] **Step 1: Inspect the committed diff**

Run:

```bash
git show --format=fuller --find-renames HEAD -- src/features/payments
```

Verify:

- only transaction failures can reach `Failed to create/update payment`;
- both post-commit tasks are attempted independently;
- each post-commit rejection is reported with its operation name;
- the dispatcher resolves after rejected tasks;
- the committed payment response remains `success(undefined)`; and
- no payment, schema, migration, or unrelated service behavior changed.

- [ ] **Step 2: Re-run the focused regression**

Run:

```bash
pnpm test src/features/payments/services/payment-post-commit.test.ts
```

Expected: 2 tests PASS with zero failures.
