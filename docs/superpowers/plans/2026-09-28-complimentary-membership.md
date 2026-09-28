# Complimentary Membership (Request + Approval) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let staff request a free membership on an existing single-member plan, requiring a second staff member's approval before any membership or payment record is created, with SMS + in-app notification of the request and its decision.

**Architecture:** A new `complimentary_membership_requests` table tracks the request lifecycle (`pending`/`approved`/`rejected`) independently of `paymentStatusEnum`. Submission validates and stores the request only. Approval writes a real `payments` row (all money fields `0`, `method: "complimentary"`) plus a `memberMemberships` row directly inside one transaction — it does **not** call `finalizeMembershipPayment` and posts no journal entry. Rejection only updates the request row. All three mutations reuse `checkMembershipOverlap`, `lockMemberMembershipCreation`, and `PaymentTransactionError` from the existing manual-payment flow (exported for reuse, not duplicated). Void's reversal-journal builder is patched to skip reversal (not error) when a `complimentary` payment has no journal entry to reverse. UI mirrors the existing receipts feature: `useAppForm` submission form, a `DataTable` approval queue, and a reason-required rejection modal styled on `VoidPaymentModal`.

**Tech Stack:** TanStack Router/Start (`createServerFn`), Drizzle ORM + PostgreSQL, Zod, TanStack Form (`useAppForm`) + TanStack Query, Vitest, Biome.

**Spec:** The original task brief (pasted by the user into this conversation) is the spec this plan implements; no separate spec file exists on disk. Its "Decisions Already Made" section is authoritative and is folded into the constraints below.

## Global Constraints

- Do not touch `createManualMembershipPaymentFn`'s zero-amount guard (`payment.mutations.api.ts:349-354`) — it is a paid-path guard, unrelated to this flow.
- Do not call `finalizeMembershipPayment` from this flow — approval writes `payments`/`paymentMembers`/`memberMemberships` directly.
- No journal entry is ever posted for a `method: "complimentary"` payment.
- No maker-checker restriction: the same user may hold both permissions and approve their own request.
- `sendSms` is best-effort only: never call it inside a `db.transaction`, never let its failure affect the mutation's own `Result`, and it already swallows its own errors (no retry logic).
- Reason/rejection-reason fields use the exact same convention as `voidPaymentSchema.voidReason`: `z.string().trim().min(10, { error: "..." })`.
- `users.contact` is already stored in the `+254XXXXXXXXX` E.164 shape (confirmed from seed data: `src/drizzle/seed/users.ts:11`), which already satisfies `smsSchema`'s `/\+254\d{9}/` regex — **no normalization is needed** for notification recipients or the requester. (This resolves the "stop and ask if formats don't cleanly normalize" contingency from the original brief: they do.)
- Single-member plans only (`membershipPlans.memberCount === 1`) — both submission and approval must reject group plans, and the UI plan picker must filter them out rather than merely validating after the fact.
- Migrations: generate via `pnpm db:generate`, do **not** run `pnpm db:migrate` / `pnpm db:push`.
- Follow AGENTS.md: server reads/writes via `createServerFn`, permission checks via `requirePermission`/`requireAnyPermission`, `Result`/`success`/`failure` from `@/lib/result`, activity logging via `logActivity`/`activityLogs` insert, TanStack Query definitions co-located in `services/queries.ts`-style files.

## Review Focus

- **Re-approval race**: two approvers submitting `approveComplimentaryRequestFn` for the same request concurrently — the `status !== "pending"` re-check inside the transaction (Task 6) must make the second one fail cleanly, not double-create a payment. Covered by Task 6's status-guard code; no automated test (requires a real DB to exercise), but the guard is structurally identical to `voidPaymentFn`'s eligibility re-check pattern already proven in this codebase.
- **Group plan smuggled through**: a client bypassing the UI filter and submitting a `planId` for a `memberCount > 1` plan — both `requestComplimentaryMembershipFn` (Task 6) and `approveComplimentaryRequestFn` (Task 6) must reject it server-side, not just filter it from the dropdown (Task 10).
- **Missing/malformed recipient phone numbers**: an admin user with a null or malformed `contact` value — the notification helper (Task 5) must skip that recipient (not crash the request/approval) and is unit-tested via `selectValidContacts`.
- **Overlap re-validated at approval time, not just submission**: time between submission and approval — a different payment could now occupy the requested date range. Task 6's approval handler must re-run `checkMembershipOverlap` inside its own transaction (not trust the submission-time check) and leave the request `pending` (not silently drop it) on conflict.
- **Void of a complimentary payment with no journal entry**: voiding a `method: "complimentary"` payment must skip journal reversal, not error out — but voiding a normal payment that is unexpectedly missing its journal entry must still fail loudly (real corruption). Covered by Task 8's `payment.method === "complimentary"` branch, which preserves the original failure path for every other method.

---

## Task 1: Database schema — payment method enum, request table, migration

**Files:**
- Modify: `src/drizzle/schemas/payment-enums.ts`
- Create: `src/drizzle/schemas/complimentary-memberships.ts`
- Modify: `src/drizzle/schema.ts`
- Create: generated migration under `src/drizzle/migrations/` (via `pnpm db:generate` — do not hand-write)

**Interfaces:**
- Produces: `complimentaryMembershipRequests` table, `complimentaryRequestStatusEnum`/`complimentaryRequestStatuses` (`"pending" | "approved" | "rejected"`), and `"complimentary"` added to `paymentMethods`/`PaymentMethod`. All later tasks import `complimentaryMembershipRequests` from `@/drizzle/schema`.

- [ ] **Step 1: Add `"complimentary"` to the payment methods enum**

In `src/drizzle/schemas/payment-enums.ts`, change:

```ts
export const paymentMethods = [
	"mpesa_stk",
	"mpesa_manual",
	"cash",
	"card",
	"bank_transfer",
] as const;
```

to:

```ts
export const paymentMethods = [
	"mpesa_stk",
	"mpesa_manual",
	"cash",
	"card",
	"bank_transfer",
	"complimentary",
] as const;
```

- [ ] **Step 2: Create the complimentary-memberships schema file**

Create `src/drizzle/schemas/complimentary-memberships.ts`:

```ts
import { relations } from "drizzle-orm";
import { date, index, integer, pgEnum, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "@/drizzle/schema-helpers";
import { users } from "./auth";
import { members, membershipPlans } from "./member";
import { payments } from "./payments";

export const complimentaryRequestStatuses = ["pending", "approved", "rejected"] as const;
export type ComplimentaryRequestStatus = (typeof complimentaryRequestStatuses)[number];
export const complimentaryRequestStatusEnum = pgEnum(
	"complimentary_request_status",
	complimentaryRequestStatuses
);

export const complimentaryMembershipRequests = pgTable(
	"complimentary_membership_requests",
	{
		id,
		memberId: varchar("member_id").notNull().references(() => members.id),
		planId: varchar("plan_id").notNull().references(() => membershipPlans.id),
		startDate: date("start_date").notNull(),
		numberOfPeriods: integer("number_of_periods").notNull().default(1),
		reason: text("reason").notNull(),
		status: complimentaryRequestStatusEnum("status").notNull().default("pending"),
		requestedByUserId: varchar("requested_by_user_id").notNull().references(() => users.id),
		reviewedByUserId: varchar("reviewed_by_user_id").references(() => users.id),
		reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
		rejectionReason: text("rejection_reason"),
		resultingPaymentId: varchar("resulting_payment_id").references(() => payments.id),
		createdAt,
		updatedAt,
	},
	(table) => [
		index("idx_complimentary_requests_status").on(table.status),
		index("idx_complimentary_requests_member_id").on(table.memberId),
	]
);

export const complimentaryMembershipRequestsRelations = relations(
	complimentaryMembershipRequests,
	({ one }) => ({
		member: one(members, {
			fields: [complimentaryMembershipRequests.memberId],
			references: [members.id],
		}),
		plan: one(membershipPlans, {
			fields: [complimentaryMembershipRequests.planId],
			references: [membershipPlans.id],
		}),
		requestedByUser: one(users, {
			fields: [complimentaryMembershipRequests.requestedByUserId],
			references: [users.id],
		}),
		reviewedByUser: one(users, {
			fields: [complimentaryMembershipRequests.reviewedByUserId],
			references: [users.id],
		}),
		resultingPayment: one(payments, {
			fields: [complimentaryMembershipRequests.resultingPaymentId],
			references: [payments.id],
		}),
	})
);
```

- [ ] **Step 3: Wire the new schema file into the barrel**

In `src/drizzle/schema.ts`, insert alphabetically after `chart-of-accounts`, before `credit-notes`:

```ts
export * from "@/drizzle/schemas/chart-of-accounts";
export * from "@/drizzle/schemas/complimentary-memberships";
export * from "@/drizzle/schemas/credit-notes";
```

- [ ] **Step 4: Generate the migration (do not run it)**

Run: `pnpm db:generate`
Expected: a new file appears under `src/drizzle/migrations/` containing `ALTER TYPE "public"."payment_method" ADD VALUE 'complimentary'`, `CREATE TYPE "public"."complimentary_request_status" ...`, and `CREATE TABLE "complimentary_membership_requests" ...`. Do **not** run `pnpm db:migrate` or `pnpm db:push`.

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck` (or `tsc --noEmit` per the project's typecheck script)
Expected: no new errors from the schema files.

- [ ] **Step 6: Commit**

```bash
git add src/drizzle/schemas/payment-enums.ts src/drizzle/schemas/complimentary-memberships.ts src/drizzle/schema.ts src/drizzle/migrations/
git commit -m "add complimentary membership request schema"
```

---

## Task 2: Permissions

**Files:**
- Modify: `src/lib/permissions/constants.ts`

**Interfaces:**
- Produces: `"receipts:complimentary-request"`, `"receipts:complimentary-approve"` as valid `Permission` values, used by every server function and route in later tasks.

- [ ] **Step 1: Add the two permission strings**

In `src/lib/permissions/constants.ts`, inside the `PERMISSIONS` array, insert immediately after the existing `"receipts:top-up-late"` entry:

```ts
	"receipts:top-up-late",
	"receipts:complimentary-request",
	"receipts:complimentary-approve",
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: passes (this is a pure type-level addition).

- [ ] **Step 3: Commit**

```bash
git add src/lib/permissions/constants.ts
git commit -m "add complimentary membership permissions"
```

---

## Task 3: Export shared reuse helpers from `payment.mutations.api.ts`

**Files:**
- Modify: `src/features/receipts/services/payment.mutations.api.ts:77, 83, 118`

**Interfaces:**
- Produces: `PaymentTransactionError` (class), `checkMembershipOverlap` (async function), `lockMemberMembershipCreation` (async function) — all now exported for Task 6 to import.
- Consumes: none new.

- [ ] **Step 1: Export the three symbols**

In `src/features/receipts/services/payment.mutations.api.ts`, change the three local declarations to exported:

```ts
export class PaymentTransactionError extends Error {
	constructor(readonly result: Extract<Result<never>, { success: false }>) {
		super("payment transaction rolled back");
	}
}
```

```ts
export async function checkMembershipOverlap({
	tx,
	memberIds,
	startDate,
	endDate,
}: {
	tx: Transaction;
	memberIds: string[];
	startDate: string;
	endDate: string;
}): Promise<Result<void>> {
```

```ts
export async function lockMemberMembershipCreation(tx: Transaction, memberId: string) {
```

Only the `export` keyword changes — no logic changes. All three symbols keep their exact current bodies.

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: passes; no behavior change in this file, only visibility.

- [ ] **Step 3: Commit**

```bash
git add src/features/receipts/services/payment.mutations.api.ts
git commit -m "export payment transaction helpers for reuse by complimentary membership flow"
```

---

## Task 4: Zod schemas for the complimentary flow (+ tests)

**Files:**
- Create: `src/features/receipts/services/complimentary.schemas.ts`
- Test: `src/features/receipts/services/complimentary.schemas.test.ts`

**Interfaces:**
- Produces: `complimentaryRequestSchema`, `ComplimentaryRequestSchema` (type), `rejectComplimentaryRequestSchema`, `RejectComplimentaryRequestSchema` (type), `complimentaryRequestsSearchSchema`, `ComplimentaryRequestsSearchSchema` (type). Consumed by Task 6 (mutations), Task 7 (queries), Task 9 (hooks), Task 10/11 (forms).

- [ ] **Step 1: Write the failing tests**

Create `src/features/receipts/services/complimentary.schemas.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
	complimentaryRequestSchema,
	rejectComplimentaryRequestSchema,
} from "./complimentary.schemas";

describe("complimentaryRequestSchema", () => {
	const validInput = {
		memberId: "member-1",
		planId: "plan-1",
		startDate: "2026-10-01",
		numberOfPeriods: 1,
		reason: "Loyal member of 5 years, retention gesture",
	};

	it("accepts a fully valid request", () => {
		expect(complimentaryRequestSchema.safeParse(validInput).success).toBe(true);
	});

	it("rejects a reason shorter than 10 characters", () => {
		const result = complimentaryRequestSchema.safeParse({ ...validInput, reason: "too short" });
		expect(result.success).toBe(false);
	});

	it("rejects a non-integer numberOfPeriods", () => {
		const result = complimentaryRequestSchema.safeParse({ ...validInput, numberOfPeriods: 1.5 });
		expect(result.success).toBe(false);
	});

	it("rejects numberOfPeriods below 1", () => {
		const result = complimentaryRequestSchema.safeParse({ ...validInput, numberOfPeriods: 0 });
		expect(result.success).toBe(false);
	});

	it("rejects a missing planId", () => {
		const result = complimentaryRequestSchema.safeParse({ ...validInput, planId: "" });
		expect(result.success).toBe(false);
	});
});

describe("rejectComplimentaryRequestSchema", () => {
	it("accepts a rejection reason of at least 10 characters", () => {
		const result = rejectComplimentaryRequestSchema.safeParse({
			requestId: "req-1",
			rejectionReason: "Plan does not match retention policy",
		});
		expect(result.success).toBe(true);
	});

	it("rejects a rejection reason shorter than 10 characters", () => {
		const result = rejectComplimentaryRequestSchema.safeParse({
			requestId: "req-1",
			rejectionReason: "too short",
		});
		expect(result.success).toBe(false);
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run src/features/receipts/services/complimentary.schemas.test.ts`
Expected: FAIL — `complimentary.schemas.ts` does not exist yet.

- [ ] **Step 3: Write the schema file**

Create `src/features/receipts/services/complimentary.schemas.ts`:

```ts
import { z } from "zod";
import { requiredStringNonLowerSchemaEntry } from "@/lib/schema-rules";

export const complimentaryRequestSchema = z.object({
	memberId: requiredStringNonLowerSchemaEntry("Member is required"),
	planId: requiredStringNonLowerSchemaEntry("Plan is required"),
	startDate: z.iso.date({ error: "Start date is required" }),
	numberOfPeriods: z
		.number()
		.int({ error: "Must be a whole number" })
		.min(1, { error: "Must be at least 1" }),
	reason: z.string().trim().min(10, { error: "Reason must be at least 10 characters" }),
});
export type ComplimentaryRequestSchema = z.infer<typeof complimentaryRequestSchema>;

export const rejectComplimentaryRequestSchema = z.object({
	requestId: requiredStringNonLowerSchemaEntry("Request is required"),
	rejectionReason: z.string().trim().min(10, { error: "Reason must be at least 10 characters" }),
});
export type RejectComplimentaryRequestSchema = z.infer<typeof rejectComplimentaryRequestSchema>;

export const complimentaryRequestsSearchSchema = z.object({
	status: z.enum(["all", "pending", "approved", "rejected"]).optional().catch("all"),
});
export type ComplimentaryRequestsSearchSchema = z.infer<typeof complimentaryRequestsSearchSchema>;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run src/features/receipts/services/complimentary.schemas.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add src/features/receipts/services/complimentary.schemas.ts src/features/receipts/services/complimentary.schemas.test.ts
git commit -m "add complimentary membership request/reject schemas"
```

---

## Task 5: Notification helper (+ tests)

**Files:**
- Create: `src/features/receipts/lib/complimentary-notifications.ts`
- Test: `src/features/receipts/lib/complimentary-notifications.test.ts`

**Interfaces:**
- Consumes: `sendSms`, `smsSchema` from `@/lib/sms`; `db` from `@/drizzle/db`; `members`, `membershipPlans`, `users` from `@/drizzle/schema`; `complimentaryMembershipRequests` row type from `@/drizzle/schema`.
- Produces: `selectValidContacts(contacts: Array<string | null | undefined>): string[]`, `buildRequestSubmittedMessage(...)`, `buildDecisionMessage(...)`, `notifyComplimentaryRequestSubmitted(request)`, `notifyComplimentaryRequestDecision(request)`. Consumed by Task 6.

- [ ] **Step 1: Write the failing tests**

Create `src/features/receipts/lib/complimentary-notifications.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
	buildDecisionMessage,
	buildRequestSubmittedMessage,
	selectValidContacts,
} from "./complimentary-notifications";

describe("selectValidContacts", () => {
	it("keeps only +254XXXXXXXXX E.164 numbers", () => {
		expect(
			selectValidContacts(["+254712345001", "0712000001", null, undefined, "", "+1555123"])
		).toEqual(["+254712345001"]);
	});

	it("returns an empty array when nothing is valid", () => {
		expect(selectValidContacts([null, undefined, ""])).toEqual([]);
	});
});

describe("buildRequestSubmittedMessage", () => {
	it("includes member, plan, and requester", () => {
		const message = buildRequestSubmittedMessage({
			memberName: "Jane Doe",
			planName: "Gold Plan",
			requesterName: "John Staff",
		});
		expect(message).toContain("Jane Doe");
		expect(message).toContain("Gold Plan");
		expect(message).toContain("John Staff");
	});
});

describe("buildDecisionMessage", () => {
	it("has no reason line when approved", () => {
		const message = buildDecisionMessage({ status: "approved", rejectionReason: null });
		expect(message.toLowerCase()).toContain("approved");
		expect(message).not.toContain("Reason:");
	});

	it("includes the rejection reason when rejected", () => {
		const message = buildDecisionMessage({
			status: "rejected",
			rejectionReason: "Does not meet retention criteria",
		});
		expect(message.toLowerCase()).toContain("rejected");
		expect(message).toContain("Does not meet retention criteria");
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run src/features/receipts/lib/complimentary-notifications.test.ts`
Expected: FAIL — module does not exist yet.

- [ ] **Step 3: Write the notification helper**

Create `src/features/receipts/lib/complimentary-notifications.ts`:

```ts
import { eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { members, membershipPlans, users, type complimentaryMembershipRequests } from "@/drizzle/schema";
import { sendSms, smsSchema } from "@/lib/sms";

type ComplimentaryRequestRow = typeof complimentaryMembershipRequests.$inferSelect;

export function selectValidContacts(contacts: Array<string | null | undefined>): string[] {
	return contacts.filter((contact): contact is string => {
		if (!contact) return false;
		return smsSchema.shape.to.element.safeParse(contact).success;
	});
}

export function buildRequestSubmittedMessage({
	memberName,
	planName,
	requesterName,
}: {
	memberName: string;
	planName: string;
	requesterName: string;
}) {
	return `New complimentary membership request for ${memberName} (${planName}) from ${requesterName}. Review in the app.`;
}

export function buildDecisionMessage({
	status,
	rejectionReason,
}: {
	status: "approved" | "rejected";
	rejectionReason?: string | null;
}) {
	if (status === "approved") {
		return "Your complimentary membership request has been approved.";
	}
	return `Your complimentary membership request was rejected.${
		rejectionReason ? ` Reason: ${rejectionReason}` : ""
	}`;
}

async function sendToValidContacts(contacts: Array<string | null | undefined>, message: string) {
	const validNumbers = selectValidContacts(contacts);
	if (validNumbers.length === 0) {
		console.log("Complimentary membership notification skipped: no valid recipient phone numbers.");
		return;
	}
	const parsed = smsSchema.safeParse({ to: validNumbers, message });
	if (!parsed.success) {
		console.log(parsed.error);
		return;
	}
	// sendSms already swallows its own errors and logs internally — no try/catch needed here.
	await sendSms(parsed.data);
}

// Best-effort, called after the submitting transaction has committed — never
// throws, never affects the caller's Result.
export async function notifyComplimentaryRequestSubmitted(request: ComplimentaryRequestRow) {
	const [member, plan, requester, recipients] = await Promise.all([
		db.query.members.findFirst({
			where: eq(members.id, request.memberId),
			columns: { firstName: true, lastName: true },
		}),
		db.query.membershipPlans.findFirst({
			where: eq(membershipPlans.id, request.planId),
			columns: { name: true },
		}),
		db.query.users.findFirst({
			where: eq(users.id, request.requestedByUserId),
			columns: { name: true },
		}),
		db.query.users.findMany({
			where: (usersTable, { and, eq: eqOp }) =>
				and(
					eqOp(usersTable.role, "admin"),
					eqOp(usersTable.active, true),
					eqOp(usersTable.isSystemAdmin, false)
				),
			columns: { contact: true },
		}),
	]);

	const message = buildRequestSubmittedMessage({
		memberName: member ? `${member.firstName} ${member.lastName}` : "a member",
		planName: plan?.name ?? "a plan",
		requesterName: requester?.name ?? "a staff member",
	});

	await sendToValidContacts(
		recipients.map((recipient) => recipient.contact),
		message
	);
}

// Best-effort, called after the approving/rejecting transaction has committed.
export async function notifyComplimentaryRequestDecision(request: ComplimentaryRequestRow) {
	const requester = await db.query.users.findFirst({
		where: eq(users.id, request.requestedByUserId),
		columns: { contact: true },
	});
	const message = buildDecisionMessage({
		status: request.status as "approved" | "rejected",
		rejectionReason: request.rejectionReason,
	});
	await sendToValidContacts([requester?.contact], message);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run src/features/receipts/lib/complimentary-notifications.test.ts`
Expected: PASS (6 tests). Note: `notifyComplimentaryRequestSubmitted`/`notifyComplimentaryRequestDecision` are not unit-tested here (they hit `db`); only the pure `selectValidContacts`/`buildRequestSubmittedMessage`/`buildDecisionMessage` functions are, per this codebase's "small targeted tests" convention.

- [ ] **Step 5: Typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add src/features/receipts/lib/complimentary-notifications.ts src/features/receipts/lib/complimentary-notifications.test.ts
git commit -m "add complimentary membership notification helper"
```

---

## Task 6: Server mutations — request, approve, reject

**Files:**
- Create: `src/features/receipts/services/complimentary.mutations.api.ts`

**Interfaces:**
- Consumes: `checkMembershipOverlap`, `lockMemberMembershipCreation`, `PaymentTransactionError` (Task 3); `complimentaryRequestSchema`, `rejectComplimentaryRequestSchema` (Task 4); `notifyComplimentaryRequestSubmitted`, `notifyComplimentaryRequestDecision` (Task 5); `getPaymentNo` from `@/features/receipts/services/payments.queries.api`; `computeMembershipEndDate` from `@/features/receipts/lib/helpers`; `dateFormat` from `@/lib/helpers`.
- Produces: `requestComplimentaryMembershipFn`, `approveComplimentaryRequestFn`, `rejectComplimentaryRequestFn` — all `createServerFn` instances returning `Result<...>`. Consumed by Task 9 (hooks).

- [ ] **Step 1: Write the mutations file**

Create `src/features/receipts/services/complimentary.mutations.api.ts`:

```ts
import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import {
	activityLogs,
	complimentaryMembershipRequests,
	memberMemberships,
	members,
	membershipPlans,
	paymentMembers,
	payments,
} from "@/drizzle/schema";
import {
	notifyComplimentaryRequestDecision,
	notifyComplimentaryRequestSubmitted,
} from "@/features/receipts/lib/complimentary-notifications";
import { computeMembershipEndDate } from "@/features/receipts/lib/helpers";
import {
	checkMembershipOverlap,
	lockMemberMembershipCreation,
	PaymentTransactionError,
} from "@/features/receipts/services/payment.mutations.api";
import { getPaymentNo } from "@/features/receipts/services/payments.queries.api";
import {
	complimentaryRequestSchema,
	rejectComplimentaryRequestSchema,
} from "@/features/receipts/services/complimentary.schemas";
import { dateFormat } from "@/lib/helpers";
import { requirePermission } from "@/lib/permissions/permissions";
import { failure, success } from "@/lib/result";
import { authMiddleware } from "@/middlewares/auth-middleware";

export const requestComplimentaryMembershipFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(complimentaryRequestSchema)
	.handler(
		async ({
			data: { memberId, planId, startDate, numberOfPeriods, reason },
			context: {
				user: { id: userId },
			},
		}) => {
			await requirePermission("receipts:complimentary-request");

			const member = await db.query.members.findFirst({
				where: eq(members.id, memberId),
				columns: { id: true, memberStatus: true },
			});
			if (!member || member.memberStatus !== "active") {
				return failure({ type: "ApplicationError", message: "Member must be active." });
			}

			const plan = await db.query.membershipPlans.findFirst({
				where: eq(membershipPlans.id, planId),
			});
			if (!plan || !plan.active) {
				return failure({ type: "NotFoundError", message: "Plan not found or inactive." });
			}
			if (plan.memberCount !== 1) {
				return failure({
					type: "ApplicationError",
					message: "Only single-member plans are eligible for complimentary membership.",
				});
			}

			const candidateEndDate = dateFormat(
				computeMembershipEndDate(startDate, plan.duration, numberOfPeriods)
			);

			try {
				const result = await db.transaction(async (tx) => {
					const overlapCheck = await checkMembershipOverlap({
						tx,
						memberIds: [memberId],
						startDate,
						endDate: candidateEndDate,
					});
					if (!overlapCheck.success) {
						throw new PaymentTransactionError(overlapCheck);
					}

					const [request] = await tx
						.insert(complimentaryMembershipRequests)
						.values({
							memberId,
							planId,
							startDate,
							numberOfPeriods,
							reason,
							status: "pending",
							requestedByUserId: userId,
						})
						.returning();

					await tx.insert(activityLogs).values({
						userId,
						action: "request complimentary membership",
						description: `Requested complimentary membership on plan ${plan.name} for member ${memberId}.`,
					});

					return success(request);
				});

				if (result.success) {
					notifyComplimentaryRequestSubmitted(result.data).catch((error) => console.log(error));
				}

				return result;
			} catch (error) {
				if (error instanceof PaymentTransactionError) {
					return error.result;
				}
				console.log(error);
				return failure({
					type: "ApplicationError",
					message: "Something went wrong.Please try again.",
				});
			}
		}
	);

export const approveComplimentaryRequestFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator((requestId: string) => requestId)
	.handler(
		async ({
			data: requestId,
			context: {
				user: { id: userId },
			},
		}) => {
			await requirePermission("receipts:complimentary-approve");

			try {
				const result = await db.transaction(async (tx) => {
					const request = await tx.query.complimentaryMembershipRequests.findFirst({
						where: eq(complimentaryMembershipRequests.id, requestId),
					});
					if (!request) {
						throw new PaymentTransactionError(
							failure({ type: "NotFoundError", message: "Complimentary request not found." })
						);
					}
					if (request.status !== "pending") {
						throw new PaymentTransactionError(
							failure({
								type: "ConflictError",
								message: `This request has already been ${request.status}.`,
							})
						);
					}

					await lockMemberMembershipCreation(tx, request.memberId);

					const member = await tx.query.members.findFirst({
						where: eq(members.id, request.memberId),
						columns: { id: true, memberStatus: true },
					});
					if (!member || member.memberStatus !== "active") {
						throw new PaymentTransactionError(
							failure({ type: "ApplicationError", message: "Member is no longer active." })
						);
					}

					const plan = await tx.query.membershipPlans.findFirst({
						where: eq(membershipPlans.id, request.planId),
					});
					if (!plan || !plan.active) {
						throw new PaymentTransactionError(
							failure({ type: "NotFoundError", message: "Plan is no longer active." })
						);
					}

					const candidateEndDate = dateFormat(
						computeMembershipEndDate(request.startDate, plan.duration, request.numberOfPeriods)
					);
					const overlapCheck = await checkMembershipOverlap({
						tx,
						memberIds: [request.memberId],
						startDate: request.startDate,
						endDate: candidateEndDate,
					});
					if (!overlapCheck.success) {
						throw new PaymentTransactionError(overlapCheck);
					}

					const paymentNo = await getPaymentNo();

					const [payment] = await tx
						.insert(payments)
						.values({
							paymentDate: new Date(),
							memberId: request.memberId,
							planId: request.planId,
							paymentNo: paymentNo.toString(),
							amount: "0",
							numberOfPeriods: request.numberOfPeriods,
							discountType: "none",
							discountedAmount: "0",
							lineTotal: "0",
							taxAmount: "0",
							totalAmount: "0",
							status: "completed",
							method: "complimentary",
							channel: "staff",
							createdByUserId: request.requestedByUserId,
						})
						.returning();

					await tx.insert(paymentMembers).values({
						paymentId: payment.id,
						memberId: request.memberId,
					});

					const today = dateFormat(new Date());
					const membershipStatus = request.startDate > today ? "pending" : "active";
					const endDate = computeMembershipEndDate(
						request.startDate,
						plan.duration,
						request.numberOfPeriods
					);

					const mostRecentMembership = await tx.query.memberMemberships.findFirst({
						where: eq(memberMemberships.memberId, request.memberId),
						orderBy: (memberships, { desc }) => [desc(memberships.endDate)],
						columns: { membershipPlanId: true },
					});

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
					});

					const [updatedRequest] = await tx
						.update(complimentaryMembershipRequests)
						.set({
							status: "approved",
							reviewedByUserId: userId,
							reviewedAt: new Date(),
							resultingPaymentId: payment.id,
						})
						.where(eq(complimentaryMembershipRequests.id, request.id))
						.returning();

					await tx.insert(activityLogs).values({
						userId,
						action: "approve complimentary membership",
						description: `Approved complimentary membership request for member ${request.memberId}, creating payment ${paymentNo}.`,
					});

					return success(updatedRequest);
				});

				if (result.success) {
					notifyComplimentaryRequestDecision(result.data).catch((error) => console.log(error));
				}

				return result;
			} catch (error) {
				if (error instanceof PaymentTransactionError) {
					return error.result;
				}
				console.log(error);
				return failure({
					type: "ApplicationError",
					message: "Something went wrong.Please try again.",
				});
			}
		}
	);

export const rejectComplimentaryRequestFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(rejectComplimentaryRequestSchema)
	.handler(
		async ({
			data: { requestId, rejectionReason },
			context: {
				user: { id: userId },
			},
		}) => {
			await requirePermission("receipts:complimentary-approve");

			try {
				const result = await db.transaction(async (tx) => {
					const request = await tx.query.complimentaryMembershipRequests.findFirst({
						where: eq(complimentaryMembershipRequests.id, requestId),
					});
					if (!request) {
						throw new PaymentTransactionError(
							failure({ type: "NotFoundError", message: "Complimentary request not found." })
						);
					}
					if (request.status !== "pending") {
						throw new PaymentTransactionError(
							failure({
								type: "ConflictError",
								message: `This request has already been ${request.status}.`,
							})
						);
					}

					const [updatedRequest] = await tx
						.update(complimentaryMembershipRequests)
						.set({
							status: "rejected",
							reviewedByUserId: userId,
							reviewedAt: new Date(),
							rejectionReason,
						})
						.where(eq(complimentaryMembershipRequests.id, request.id))
						.returning();

					await tx.insert(activityLogs).values({
						userId,
						action: "reject complimentary membership",
						description: `Rejected complimentary membership request for member ${request.memberId}. Reason: ${rejectionReason}.`,
					});

					return success(updatedRequest);
				});

				if (result.success) {
					notifyComplimentaryRequestDecision(result.data).catch((error) => console.log(error));
				}

				return result;
			} catch (error) {
				if (error instanceof PaymentTransactionError) {
					return error.result;
				}
				console.log(error);
				return failure({
					type: "ApplicationError",
					message: "Something went wrong.Please try again.",
				});
			}
		}
	);
```

- [ ] **Step 2: Typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: both pass. Pay attention to `memberMemberships.status`/`request.status` literal-union typing (`"pending" | "active"` must satisfy `membershipStatusEnum`) and `payments.amount`/`lineTotal`/`totalAmount`/`taxAmount`/`discountedAmount` all accepting the string `"0"`.

- [ ] **Step 3: Commit**

```bash
git add src/features/receipts/services/complimentary.mutations.api.ts
git commit -m "add complimentary membership request, approve, and reject server functions"
```

---

## Task 7: Server queries — list requests, fetch by resulting payment

**Files:**
- Create: `src/features/receipts/services/complimentary.queries.api.ts`
- Create: `src/features/receipts/services/complimentary.queries.ts`

**Interfaces:**
- Consumes: `complimentaryRequestsSearchSchema` (Task 4); `userHasPermission` from `@/lib/permissions/permission-queries`; `requireAnyPermission`/`requirePermission` from `@/lib/permissions/permissions`.
- Produces: `getComplimentaryRequests`, `getComplimentaryRequestByPaymentId` (server fns); `complimentaryQueries.all`, `.list(filters)`, `.byPaymentId(paymentId)` (query-options object). Consumed by Task 11 (table) and Task 12 (payment-details audit section).

- [ ] **Step 1: Write the queries server-function file**

Create `src/features/receipts/services/complimentary.queries.api.ts`:

```ts
import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { complimentaryMembershipRequests } from "@/drizzle/schema";
import { complimentaryRequestsSearchSchema } from "@/features/receipts/services/complimentary.schemas";
import { userHasPermission } from "@/lib/permissions/permission-queries";
import { requireAnyPermission, requirePermission } from "@/lib/permissions/permissions";
import { authMiddleware } from "@/middlewares/auth-middleware";

export const getComplimentaryRequests = createServerFn()
	.middleware([authMiddleware])
	.validator(complimentaryRequestsSearchSchema)
	.handler(async ({ data: { status }, context: { user } }) => {
		await requireAnyPermission(["receipts:complimentary-request", "receipts:complimentary-approve"]);

		const canApprove = await userHasPermission(user.id, user.role, "receipts:complimentary-approve");

		return db.query.complimentaryMembershipRequests.findMany({
			where: and(
				status && status !== "all" ? eq(complimentaryMembershipRequests.status, status) : undefined,
				canApprove ? undefined : eq(complimentaryMembershipRequests.requestedByUserId, user.id)
			),
			with: {
				member: { columns: { firstName: true, lastName: true } },
				plan: { columns: { name: true } },
				requestedByUser: { columns: { name: true } },
				reviewedByUser: { columns: { name: true } },
			},
			orderBy: (requests, { desc }) => [desc(requests.createdAt)],
		});
	});

export const getComplimentaryRequestByPaymentId = createServerFn()
	.middleware([authMiddleware])
	.validator((paymentId: string) => paymentId)
	.handler(async ({ data: paymentId }) => {
		await requirePermission("receipts:view");
		return db.query.complimentaryMembershipRequests.findFirst({
			where: eq(complimentaryMembershipRequests.resultingPaymentId, paymentId),
			with: {
				requestedByUser: { columns: { name: true } },
				reviewedByUser: { columns: { name: true } },
			},
		});
	});
```

- [ ] **Step 2: Write the TanStack Query definitions**

Create `src/features/receipts/services/complimentary.queries.ts`:

```ts
import { queryOptions } from "@tanstack/react-query";
import {
	getComplimentaryRequestByPaymentId,
	getComplimentaryRequests,
} from "@/features/receipts/services/complimentary.queries.api";
import type { ComplimentaryRequestsSearchSchema } from "@/features/receipts/services/complimentary.schemas";

export const complimentaryQueries = {
	all: ["complimentary-membership-requests"] as const,
	list: (filters: ComplimentaryRequestsSearchSchema) =>
		queryOptions({
			queryKey: [...complimentaryQueries.all, "list", filters],
			queryFn: () => getComplimentaryRequests({ data: filters }),
		}),
	byPaymentId: (paymentId: string) =>
		queryOptions({
			queryKey: [...complimentaryQueries.all, "by-payment", paymentId],
			queryFn: () => getComplimentaryRequestByPaymentId({ data: paymentId }),
		}),
};
```

- [ ] **Step 3: Typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add src/features/receipts/services/complimentary.queries.api.ts src/features/receipts/services/complimentary.queries.ts
git commit -m "add complimentary membership request queries"
```

---

## Task 8: Void — tolerate a missing journal entry for complimentary payments

**Files:**
- Modify: `src/features/receipts/lib/void.ts:127-161`
- Modify: `src/features/receipts/services/payment.mutations.api.ts:514-518, 544-554`

**Interfaces:**
- `buildVoidReversalJournalLines`'s return type changes from `Promise<Result<ReceiptJournalLine[]>>` to `Promise<Result<ReceiptJournalLine[] | null>>` — `null` means "no reversal needed." `voidPaymentFn` must skip the `createJournalEntry` call when it receives `null`.

- [ ] **Step 1: Patch `buildVoidReversalJournalLines`**

In `src/features/receipts/lib/void.ts`, replace:

```ts
export async function buildVoidReversalJournalLines(
	tx: Transaction,
	payment: VoidEligiblePayment
): Promise<Result<ReceiptJournalLine[]>> {
	const originalEntry = await tx.query.journalEntries.findFirst({
		where: and(eq(journalEntries.source, "plan payment"), eq(journalEntries.sourceId, payment.id)),
		with: {
			lines: { orderBy: (line, { asc }) => [asc(line.lineNumber)] },
		},
	});

	if (!originalEntry || originalEntry.lines.length === 0) {
		return failure({
			type: "NotFoundError",
			message: "Original journal entry for this payment was not found.",
		});
	}
```

with:

```ts
export async function buildVoidReversalJournalLines(
	tx: Transaction,
	payment: VoidEligiblePayment
): Promise<Result<ReceiptJournalLine[] | null>> {
	const originalEntry = await tx.query.journalEntries.findFirst({
		where: and(eq(journalEntries.source, "plan payment"), eq(journalEntries.sourceId, payment.id)),
		with: {
			lines: { orderBy: (line, { asc }) => [asc(line.lineNumber)] },
		},
	});

	if (!originalEntry || originalEntry.lines.length === 0) {
		// Complimentary payments (method: "complimentary") post no journal entry at
		// all — see the complimentary-membership approval flow — so there is nothing
		// to reverse; that's expected, not an error. Any other payment method missing
		// its journal entry is real data corruption and must still fail loudly.
		if (payment.method === "complimentary") {
			return success(null);
		}
		return failure({
			type: "NotFoundError",
			message: "Original journal entry for this payment was not found.",
		});
	}
```

The rest of the function (building/balance-checking `reversedLines`) is unchanged.

- [ ] **Step 2: Patch `voidPaymentFn`'s use of the result**

In `src/features/receipts/services/payment.mutations.api.ts`, the reversal-lines retrieval at lines 514-518 stays the same:

```ts
const reversalLinesResult = await buildVoidReversalJournalLines(tx, payment);
if (!reversalLinesResult.success) {
	throw new PaymentTransactionError(reversalLinesResult);
}
const reversalLines = reversalLinesResult.data;
```

Wrap the existing `createJournalEntry(...)` call (lines 544-554) in a `reversalLines !== null` guard:

```ts
if (reversalLines) {
	await createJournalEntry({
		entry: {
			entryDate: dateFormat(now),
			reference: payment.paymentNo,
			source: "payment void",
			sourceId: payment.id,
			description,
		},
		lines: reversalLines,
		tx,
	});
}
```

Everything else in `voidPaymentFn` (bank-posting mirror, credit-note restore, activity log) is untouched — the bank-posting mirror already conditions on `if (originalBankPosting)`, which naturally finds nothing for a complimentary payment since none is ever created.

- [ ] **Step 3: Typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: both pass — `reversalLines` is now `ReceiptJournalLine[] | null`, so any other read site (there are none besides the `createJournalEntry` call) must be checked by the compiler.

- [ ] **Step 4: Commit**

```bash
git add src/features/receipts/lib/void.ts src/features/receipts/services/payment.mutations.api.ts
git commit -m "let void skip journal reversal for complimentary payments"
```

---

## Task 9: Client mutation hooks

**Files:**
- Create: `src/features/receipts/hooks/use-request-complimentary-membership.ts`
- Create: `src/features/receipts/hooks/use-reject-complimentary-request.ts`

**Interfaces:**
- Consumes: `requestComplimentaryMembershipFn`, `rejectComplimentaryRequestFn` (Task 6); `ComplimentaryRequestSchema`, `RejectComplimentaryRequestSchema` (Task 4).
- Produces: `useRequestComplimentaryMembership()`, `useRejectComplimentaryRequest()` — both thin `useMutation` wrappers, mirroring `useVoidPayment` exactly. (`approveComplimentaryRequestFn` is called directly inline from the table's `ActionButton` in Task 11, not via a dedicated hook — see that task for why.)

- [ ] **Step 1: Write the request hook**

Create `src/features/receipts/hooks/use-request-complimentary-membership.ts`:

```ts
import { useMutation } from "@tanstack/react-query";
import { requestComplimentaryMembershipFn } from "@/features/receipts/services/complimentary.mutations.api";
import type { ComplimentaryRequestSchema } from "@/features/receipts/services/complimentary.schemas";

export function useRequestComplimentaryMembership() {
	return useMutation({
		mutationKey: ["complimentary-membership", "request"],
		mutationFn: async (input: ComplimentaryRequestSchema) => {
			return await requestComplimentaryMembershipFn({ data: input });
		},
	});
}
```

- [ ] **Step 2: Write the reject hook**

Create `src/features/receipts/hooks/use-reject-complimentary-request.ts`:

```ts
import { useMutation } from "@tanstack/react-query";
import { rejectComplimentaryRequestFn } from "@/features/receipts/services/complimentary.mutations.api";
import type { RejectComplimentaryRequestSchema } from "@/features/receipts/services/complimentary.schemas";

export function useRejectComplimentaryRequest() {
	return useMutation({
		mutationKey: ["complimentary-membership", "reject"],
		mutationFn: async (input: RejectComplimentaryRequestSchema) => {
			return await rejectComplimentaryRequestFn({ data: input });
		},
	});
}
```

- [ ] **Step 3: Typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add src/features/receipts/hooks/use-request-complimentary-membership.ts src/features/receipts/hooks/use-reject-complimentary-request.ts
git commit -m "add complimentary membership request and reject hooks"
```

---

## Task 10: Submission form UI + route

**Files:**
- Create: `src/features/receipts/components/complimentary-request-form.tsx`
- Create: `src/routes/app/receipts/complimentary/new.tsx`

**Interfaces:**
- Consumes: `useRequestComplimentaryMembership` (Task 9); `complimentaryRequestSchema`, `ComplimentaryRequestSchema` (Task 4); `memberQueries.activeMembers()` from `@/features/members/services/queries`; `planQueries.list()` from `@/features/plans/services/queries`; `useAppForm` from `@/lib/form`; `usePreventUnsavedChanges` from `@/hooks/use-prevent-navigation`; `ProtectedPageWithWrapper` from `@/components/ui/protected-page-with-wrapper`.

- [ ] **Step 1: Write the route (loader fetches active members + active single-member plans)**

Create `src/routes/app/receipts/complimentary/new.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { ProtectedPageWithWrapper } from "@/components/ui/protected-page-with-wrapper";
import { ComplimentaryRequestForm } from "@/features/receipts/components/complimentary-request-form";
import { memberQueries } from "@/features/members/services/queries";
import { planQueries } from "@/features/plans/services/queries";
import { requirePermission } from "@/lib/permissions/permissions";

export const Route = createFileRoute("/app/receipts/complimentary/new")({
	beforeLoad: async () => {
		await requirePermission("receipts:complimentary-request");
	},
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "New Complimentary Membership / Prime Age Beauty & Fitness Club" }],
	}),
	staticData: { breadcrumb: "New Complimentary Request" },
	loader: async ({ context: { queryClient } }) => {
		const [members, plans] = await Promise.all([
			queryClient.ensureQueryData(memberQueries.activeMembers()),
			queryClient.ensureQueryData(planQueries.list()),
		]);
		return {
			members,
			// Only active, single-member plans are eligible for complimentary
			// membership — filtered here (not just validated server-side) so the
			// dropdown never offers an ineligible plan in the first place.
			plans: plans.filter((plan) => plan.active && plan.memberCount === 1),
		};
	},
});

function RouteComponent() {
	return (
		<ProtectedPageWithWrapper
			hasBackLink
			backPath="/app/receipts/complimentary"
			buttonText="Complimentary Requests"
			permissions={["receipts:complimentary-request"]}
			size="sm"
		>
			<ComplimentaryRequestForm />
		</ProtectedPageWithWrapper>
	);
}
```

- [ ] **Step 2: Write the form component**

Create `src/features/receipts/components/complimentary-request-form.tsx`:

```tsx
import { useStore } from "@tanstack/react-form";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { CustomAlert } from "@/components/ui/custom-alert";
import { FieldGroup } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { useRequestComplimentaryMembership } from "@/features/receipts/hooks/use-request-complimentary-membership";
import {
	complimentaryRequestSchema,
	type ComplimentaryRequestSchema,
} from "@/features/receipts/services/complimentary.schemas";
import { usePreventUnsavedChanges } from "@/hooks/use-prevent-navigation";
import { useAppForm } from "@/lib/form";

const defaultValues: ComplimentaryRequestSchema = {
	memberId: "",
	planId: "",
	startDate: "",
	numberOfPeriods: 1,
	reason: "",
};

export function ComplimentaryRequestForm() {
	const { members, plans } = getRouteApi("/app/receipts/complimentary/new").useLoaderData();
	const navigate = useNavigate();
	const requestMutation = useRequestComplimentaryMembership();
	const [submissionError, setSubmissionError] = useState<string | null>(null);

	const form = useAppForm({
		defaultValues,
		validators: { onSubmit: complimentaryRequestSchema },
		onSubmit: ({ value }) => {
			setSubmissionError(null);
			requestMutation.mutate(value, {
				onSuccess: (result) => {
					if (!result.success) {
						setSubmissionError(result.error.message);
						return;
					}
					navigate({ to: "/app/receipts/complimentary" });
				},
			});
		},
	});

	const isDirty = useStore(form.store, (state) => state.isDirty);
	usePreventUnsavedChanges(isDirty);

	return (
		<div className="space-y-6">
			<PageHeader
				title="Request Complimentary Membership"
				description="Request a free membership on an existing plan for a member. Requires approval before it takes effect. Only single-member plans are eligible."
			/>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					form.handleSubmit();
				}}
			>
				<FieldGroup className="grid md:grid-cols-2 gap-4">
					<form.AppField name="memberId">
						{(field) => <field.Combobox label="Member" required placeholder="Select a member" items={members} />}
					</form.AppField>
					<form.AppField name="planId">
						{(field) => (
							<field.Combobox
								label="Plan"
								required
								placeholder="Select a single-member plan"
								helperText="Only active, single-member plans are eligible for complimentary membership."
								items={plans.map((plan) => ({ value: plan.id, label: plan.name }))}
							/>
						)}
					</form.AppField>
					<form.AppField name="startDate">
						{(field) => <field.Input label="Start Date" type="date" required />}
					</form.AppField>
					<form.AppField name="numberOfPeriods">
						{(field) => (
							<field.Input label="Number of Periods" type="number" min={1} step={1} required />
						)}
					</form.AppField>
					<form.AppField name="reason">
						{(field) => (
							<field.Textarea
								label="Reason"
								fieldClassName="col-span-2"
								placeholder="Explain why this membership is being granted for free (min. 10 characters)"
								required
							/>
						)}
					</form.AppField>
					{submissionError && (
						<div className="col-span-2">
							<CustomAlert variant="destructive" title="Error" description={submissionError} />
						</div>
					)}
					<form.AppForm>
						<form.SubmitButton buttonText="Submit request" isLoading={requestMutation.isPending} />
					</form.AppForm>
				</FieldGroup>
			</form>
		</div>
	);
}
```

- [ ] **Step 3: Typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: both pass. If `field.Combobox`'s `items` prop type doesn't structurally accept `memberQueries.activeMembers()`'s return shape or the mapped plans array, adjust the `.map` to match `ComboBoxItem` (`{ value: string; label: string }`) exactly — do not change the combobox component itself.

- [ ] **Step 4: Manual verification**

Run: `pnpm dev`, sign in as a user with `receipts:complimentary-request`, navigate to `/app/receipts/complimentary/new`, and confirm: only active members appear in the member picker, only active single-member plans appear in the plan picker, and submitting with a reason under 10 characters shows a validation error before any request hits the server.

- [ ] **Step 5: Commit**

```bash
git add src/features/receipts/components/complimentary-request-form.tsx src/routes/app/receipts/complimentary/new.tsx
git commit -m "add complimentary membership request form and route"
```

---

## Task 11: Approval queue table UI + reject modal + route

**Files:**
- Create: `src/features/receipts/components/reject-complimentary-request-modal.tsx`
- Create: `src/features/receipts/components/complimentary-requests-table.tsx`
- Create: `src/routes/app/receipts/complimentary/index.tsx`

**Interfaces:**
- Consumes: `useRejectComplimentaryRequest` (Task 9); `approveComplimentaryRequestFn` (Task 6, called directly — see Step 2 note); `complimentaryQueries` (Task 7); `rejectComplimentaryRequestSchema` (Task 4); `ActionButton` from `@/components/ui/action-button`; `useModal` from `@/integrations/modal-provider`; `DataTable` from `@/components/ui/datatable`.

- [ ] **Step 1: Write the reject modal (mirrors `VoidPaymentModal`)**

Create `src/features/receipts/components/reject-complimentary-request-modal.tsx`:

```tsx
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import toast from "react-hot-toast";
import { z } from "zod";
import { CustomAlert } from "@/components/ui/custom-alert";
import CustomModal from "@/components/ui/custom-modal";
import { FieldGroup } from "@/components/ui/field";
import { ToastContent } from "@/components/ui/toast-content";
import { useRejectComplimentaryRequest } from "@/features/receipts/hooks/use-reject-complimentary-request";
import { complimentaryQueries } from "@/features/receipts/services/complimentary.queries";
import { rejectComplimentaryRequestSchema } from "@/features/receipts/services/complimentary.schemas";
import { useModal } from "@/integrations/modal-provider";
import { useAppForm } from "@/lib/form";

// The secondary explicit-confirmation checkbox lives only in this form's local
// state — the server schema doesn't need to know about it.
const rejectFormSchema = rejectComplimentaryRequestSchema.extend({
	confirmed: z.literal(true, { error: "You must confirm this action" }),
});

export function RejectComplimentaryRequestModal({ requestId }: { requestId: string }) {
	const { setClose } = useModal();
	const queryClient = useQueryClient();
	const rejectMutation = useRejectComplimentaryRequest();
	const [submissionError, setSubmissionError] = useState<string | null>(null);

	const form = useAppForm({
		defaultValues: { requestId, rejectionReason: "", confirmed: false },
		validators: { onSubmit: rejectFormSchema },
		onSubmit: ({ value }) => {
			setSubmissionError(null);
			rejectMutation.mutate(
				{ requestId: value.requestId, rejectionReason: value.rejectionReason },
				{
					onSuccess: (result) => {
						if (!result.success) {
							setSubmissionError(result.error.message);
							return;
						}
						queryClient.invalidateQueries({ queryKey: complimentaryQueries.all });
						toast.success((t) => (
							<ToastContent
								t={t}
								title="Request rejected"
								message="Complimentary membership request rejected."
							/>
						));
						setClose();
					},
				}
			);
		},
	});

	return (
		<CustomModal
			title="Reject complimentary request"
			subtitle="This will decline the request and notify the requester."
		>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					form.handleSubmit();
				}}
			>
				<FieldGroup>
					<form.AppField name="rejectionReason">
						{(field) => (
							<field.Textarea
								label="Rejection reason"
								placeholder="Explain why this request is being rejected (min. 10 characters)"
								required
							/>
						)}
					</form.AppField>

					<form.AppField name="confirmed">
						{(field) => <field.Checkbox label="I understand this will reject the request." />}
					</form.AppField>

					{submissionError && (
						<CustomAlert variant="destructive" title="Error" description={submissionError} />
					)}
					{rejectMutation.error && (
						<CustomAlert
							variant="destructive"
							title="Error"
							description={rejectMutation.error.message}
						/>
					)}

					<form.Subscribe
						selector={(state) => [state.values.confirmed, state.values.rejectionReason] as const}
					>
						{([confirmed, rejectionReason]) => (
							<form.AppForm>
								<form.SubmitButton
									withReset
									onReset={() => {
										form.reset();
										setClose();
									}}
									buttonText="Reject request"
									buttonVariant="destructive"
									disabled={!confirmed || rejectionReason.trim().length < 10}
									isLoading={rejectMutation.isPending}
								/>
							</form.AppForm>
						)}
					</form.Subscribe>
				</FieldGroup>
			</form>
		</CustomModal>
	);
}
```

- [ ] **Step 2: Write the approval queue table**

Approve is a low-risk, no-second-reason confirm action, so it uses `ActionButton` (`requireAreYouSure`, `isDestructive={false}`) directly, calling `approveComplimentaryRequestFn` inline. `ActionButton`'s `action` prop requires `() => Promise<Result<undefined>>`, so the inline callback adapts the mutation's `Result<request>` return to `Result<undefined>` and invalidates the list query on success itself (there is no `onSuccess` prop on `ActionButton`).

Create `src/features/receipts/components/complimentary-requests-table.tsx`:

```tsx
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { ActionButton } from "@/components/ui/action-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/datatable";
import { PermissionGate } from "@/components/ui/permission-gate";
import { RejectComplimentaryRequestModal } from "@/features/receipts/components/reject-complimentary-request-modal";
import { approveComplimentaryRequestFn } from "@/features/receipts/services/complimentary.mutations.api";
import { complimentaryQueries } from "@/features/receipts/services/complimentary.queries";
import { useModal } from "@/integrations/modal-provider";
import { dateFormat } from "@/lib/helpers";
import { success } from "@/lib/result";
import { toTitleCase } from "@/lib/utils";

export function ComplimentaryRequestsTable() {
	const { data: requests } = useSuspenseQuery(complimentaryQueries.list({ status: "all" }));

	const columns: Array<ColumnDef<(typeof requests)[0]>> = [
		{
			accessorKey: "member",
			header: "Member",
			cell: ({ row }) =>
				toTitleCase(`${row.original.member.firstName} ${row.original.member.lastName}`),
		},
		{
			accessorKey: "plan",
			header: "Plan",
			cell: ({ row }) => toTitleCase(row.original.plan.name),
		},
		{
			accessorKey: "requestedByUser",
			header: "Requested By",
			cell: ({ row }) => row.original.requestedByUser.name,
		},
		{
			accessorKey: "createdAt",
			header: "Requested Date",
			cell: ({ row }) => dateFormat(row.original.createdAt, "long"),
		},
		{
			accessorKey: "status",
			header: "Status",
			cell: ({ row }) => (
				<Badge
					variant={
						row.original.status === "approved"
							? "success"
							: row.original.status === "rejected"
								? "destructive"
								: "info"
					}
					className="capitalize"
				>
					{row.original.status}
				</Badge>
			),
		},
		{
			accessorKey: "reviewedByUser",
			header: "Reviewed By",
			cell: ({ row }) =>
				row.original.reviewedByUser
					? `${row.original.reviewedByUser.name} on ${dateFormat(row.original.reviewedAt ?? new Date(), "long")}`
					: "—",
		},
		{
			id: "actions",
			cell: ({ row }) =>
				row.original.status === "pending" ? (
					<PermissionGate permission="receipts:complimentary-approve">
						<RequestActions requestId={row.original.id} />
					</PermissionGate>
				) : null,
		},
	];

	return <DataTable columns={columns} data={requests} />;
}

function RequestActions({ requestId }: { requestId: string }) {
	const queryClient = useQueryClient();
	const { setOpen } = useModal();

	return (
		<div className="flex items-center gap-2">
			<ActionButton
				variant="outline"
				size="sm"
				requireAreYouSure
				isDestructive={false}
				areYouSureDescription="This creates a KES 0 payment and activates the membership immediately."
				action={async () => {
					const result = await approveComplimentaryRequestFn({ data: requestId });
					if (!result.success) return result;
					queryClient.invalidateQueries({ queryKey: complimentaryQueries.all });
					return success(undefined);
				}}
			>
				Approve
			</ActionButton>
			<Button
				variant="destructive"
				size="sm"
				onClick={() => setOpen(<RejectComplimentaryRequestModal requestId={requestId} />)}
			>
				Reject
			</Button>
		</div>
	);
}
```

- [ ] **Step 3: Write the route**

Create `src/routes/app/receipts/complimentary/index.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { BasePageComponent } from "@/components/ui/base-page";
import { ComplimentaryRequestsTable } from "@/features/receipts/components/complimentary-requests-table";
import { requireAnyPermission } from "@/lib/permissions/permissions";

export const Route = createFileRoute("/app/receipts/complimentary/")({
	beforeLoad: async () => {
		await requireAnyPermission(["receipts:complimentary-request", "receipts:complimentary-approve"]);
	},
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "Complimentary Memberships / Prime Age Beauty & Fitness Club" }],
	}),
	staticData: { breadcrumb: "Complimentary Memberships" },
});

function RouteComponent() {
	return (
		<BasePageComponent
			pageTitle="Complimentary Memberships"
			pageDescription="Review and action complimentary membership requests"
			hasNewButtonLink
			newButtonLinkPath="/app/receipts/complimentary/new"
			createPermissions={["receipts:complimentary-request"]}
			buttonText="Request Complimentary Membership"
		>
			<ComplimentaryRequestsTable />
		</BasePageComponent>
	);
}
```

A user with only `receipts:complimentary-request` (not `-approve`) sees the list filtered server-side (Task 7's `getComplimentaryRequests`) to their own `requestedByUserId`, with no Approve/Reject actions rendered (gated by `PermissionGate permission="receipts:complimentary-approve"` in the table).

- [ ] **Step 4: Typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: both pass.

- [ ] **Step 5: Manual verification**

Run: `pnpm dev`. As a user with only `receipts:complimentary-request`, submit a request from Task 10's form, then visit `/app/receipts/complimentary` and confirm it appears with no Approve/Reject buttons. As a user with `receipts:complimentary-approve`, visit the same page, confirm Approve/Reject appear for the pending row, click Reject, confirm the modal requires 10+ characters and the checkbox, submit it, and confirm the row updates to "Rejected" with a reviewer name. Repeat with a fresh request and Approve instead, then confirm a new receipt appears at `/app/receipts` with method "Complimentary" and status "Paid".

- [ ] **Step 6: Commit**

```bash
git add src/features/receipts/components/reject-complimentary-request-modal.tsx src/features/receipts/components/complimentary-requests-table.tsx src/routes/app/receipts/complimentary/index.tsx
git commit -m "add complimentary membership approval queue"
```

---

## Task 12: Receipts integration — payment-details audit section + nav entry

**Files:**
- Modify: `src/features/receipts/components/payment-details.tsx`
- Modify: `src/routes/app/receipts/index.tsx`

**Interfaces:**
- Consumes: `complimentaryQueries.byPaymentId` (Task 7); `ClipboardCheckIcon` from `@/components/ui/icons`; `ButtonLink` from `@/components/ui/links`; `PermissionGate` from `@/components/ui/permission-gate`.

- [ ] **Step 1: Add the audit-trail alert to `PaymentDetails`**

In `src/features/receipts/components/payment-details.tsx`, add the import and query near the top of the component (after the existing `upgradeContext` query, before `currencyFormatter`):

```tsx
import { complimentaryQueries } from "@/features/receipts/services/complimentary.queries";
```

```tsx
const { data: complimentaryAudit } = useQuery({
	...complimentaryQueries.byPaymentId(payment.id),
	enabled: payment.method === "complimentary",
});
```

Then add a fourth conditional `<CustomAlert>` block, following the same sibling pattern as the existing "voided"/"upgraded"/"upgrade" blocks (insert after the "Top-up upgrade" block, before the `grid grid-cols-1 lg:grid-cols-3` summary section):

```tsx
{payment.method === "complimentary" && complimentaryAudit && (
	<CustomAlert
		title="Complimentary membership"
		description={
			<div className="space-y-1">
				<p>
					Requested by {complimentaryAudit.requestedByUser?.name ?? "Unknown"}. Reason:{" "}
					{complimentaryAudit.reason}
				</p>
				<p className="text-muted-foreground">
					Approved by {complimentaryAudit.reviewedByUser?.name ?? "Unknown"}
					{complimentaryAudit.reviewedAt
						? ` on ${format(new Date(complimentaryAudit.reviewedAt), "MMM d, yyyy 'at' p")}`
						: ""}
					.
				</p>
			</div>
		}
	/>
)}
```

No change is needed for the two existing `payment.method` rendering spots (line ~107 PDF, line ~270 summary field) — both already do a generic underscore-to-space + case transform with no method-label map, and `"complimentary"` has no underscore, so it renders correctly as "Complimentary" / "COMPLIMENTARY" automatically.

- [ ] **Step 2: Add the nav button to the receipts index page**

In `src/routes/app/receipts/index.tsx`, add imports:

```tsx
import { ClipboardCheckIcon } from "@/components/ui/icons";
import { ButtonLink } from "@/components/ui/links";
import { PermissionGate } from "@/components/ui/permission-gate";
```

Add `extraActionButtons` to the `<BasePageComponent>`:

```tsx
<BasePageComponent
	pageTitle="Membership Receipts"
	pageDescription="View and manage membership receipts"
	hasNewButtonLink
	newButtonLinkPath="/app/receipts/new"
	createPermissions={["receipts:create"]}
	defaultSearchValue={filters.q}
	onSearch={(val) => setFilters({ q: val })}
	buttonText="Add Receipt"
	extraActionButtons={
		<PermissionGate permissions={["receipts:complimentary-request", "receipts:complimentary-approve"]}>
			<ButtonLink variant="outline" path="/app/receipts/complimentary" icon={<ClipboardCheckIcon />}>
				Complimentary Memberships
			</ButtonLink>
		</PermissionGate>
	}
>
	<ReceiptsTable />
</BasePageComponent>
```

- [ ] **Step 3: Typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: both pass.

- [ ] **Step 4: Manual verification**

Run: `pnpm dev`. Visit `/app/receipts`, confirm the "Complimentary Memberships" button appears (for a user holding either new permission) and navigates correctly. Open the details page for the complimentary receipt created in Task 11's manual test, confirm the "Complimentary membership" audit alert shows the requester, reason, approver, and approval date.

- [ ] **Step 5: Commit**

```bash
git add src/features/receipts/components/payment-details.tsx src/routes/app/receipts/index.tsx
git commit -m "surface complimentary membership audit trail and navigation in receipts"
```

---

## Task 13: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck**

Run: `pnpm typecheck`
Expected: passes across the whole repo, including `src/drizzle/routeTree.gen.ts` regeneration if the dev server needs to run once to pick up the two new route files (`/app/receipts/complimentary/new`, `/app/receipts/complimentary/`). Do not hand-edit `routeTree.gen.ts`.

- [ ] **Step 2: Full test suite**

Run: `pnpm test`
Expected: all existing tests plus the new `complimentary.schemas.test.ts` and `complimentary-notifications.test.ts` pass.

- [ ] **Step 3: Full lint/format check**

Run: `pnpm check`
Expected: passes for every file touched in this plan. Do not run a repo-wide format if unrelated files already have lint/format issues (per AGENTS.md) — scope `pnpm lint`/`pnpm format` to the files listed in this plan if `pnpm check` reports pre-existing issues elsewhere.

- [ ] **Step 4: Build**

Run: `pnpm build`
Expected: succeeds with no new errors.

- [ ] **Step 5: Confirm the migration file is present but unapplied**

Run: `git status --short src/drizzle/migrations/` and `git log --oneline -1 -- src/drizzle/migrations/`
Expected: the Task 1 migration file is committed; confirm with the user before anyone runs `pnpm db:migrate`/`pnpm db:push` against a real database, since that step was intentionally left out of this plan.
