# Dashboard Active Members & Expiring Soon View Details Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a working "View Details" sheet to the "Active Members" and "Expiring Soon" KPI cards on the membership dashboard, matching the existing "Expired Memberships" card's behavior but rendered with the app's `DataTable` component (client-side pagination) instead of a plain table.

**Architecture:** Two new sheet components (`ActiveMembersSheet`, `ExpiringSoonSheet`) each backed by a TanStack Query query option and a server function, following the exact pattern `ExpiredMembershipsSheet` / `dashboardQueries.expiredMemberships()` / `getExpiredMemberships` already establishes. `ActiveMembersSheet` needs a brand-new server function; `ExpiringSoonSheet` reuses the existing `getExpiringMemberships` server function (used today by the "Membership Actions Needed" widget), with one field added to its `select`. A small shared helper is extracted from the existing widget so both it and the new sheet compute "days remaining" text identically.

**Tech Stack:** React, TanStack Query, TanStack Table (via `@/components/ui/datatable`), TanStack Start server functions, Drizzle ORM, Vitest.

## Global Constraints

- Use the `DataTable` component (`@/components/ui/datatable`) for both new sheets — it already provides client-side pagination ("Rows per page" + prev/next), so no custom pagination is built.
- No "Stop membership" action, no membership mutations — this feature is display-only.
- `ExpiringSoonSheet` must reuse the existing `getExpiringMemberships` server function and `dashboardQueries.expiringMemberships()` query option rather than introducing a new query. The only change to that function is adding `memberNo` to its `select`.
- `ActiveMembersSheet` sources data from the `membersOverview` (`vw_member_overview`) Drizzle view, filtered to `memberStatus = "active"`.
- The "Days Remaining" column text must match the current wording used by `MemberActionItem` in `src/features/dashboard/components/expiring-soon.tsx` exactly: `"Expiring in {distance}"` for future end dates, `"Expired {distance} ago"` for past end dates (where `{distance}` comes from date-fns `formatDistanceToNow`). Do not change this existing wording — only move it into a shared helper.

---

### Task 1: Extract a shared membership-expiry-status helper

**Files:**
- Modify: `src/features/dashboard/lib/helpers.ts`
- Modify: `src/features/dashboard/lib/helpers.test.ts`
- Modify: `src/features/dashboard/components/expiring-soon.tsx:1-2, 62-68, 90-96`

**Interfaces:**
- Produces: `getMembershipExpiryStatus(rawEndDate: Date | string | null): { isExpired: boolean; label: string } | null`, exported from `src/features/dashboard/lib/helpers.ts`. Later tasks (Task 4) import this from `@/features/dashboard/lib/helpers`.

- [ ] **Step 1: Write the failing tests**

Add this new `describe` block to the end of `src/features/dashboard/lib/helpers.test.ts` (it already imports `afterEach, describe, expect, it, vi` from `vitest` and `format` from `date-fns` — no new top-level imports needed there):

```ts
import { getMembershipExpiryStatus } from "./helpers";
```

Add this to the existing `import { getExpiredMembershipStatDates, getFinanceStatDates } from "./helpers";` line instead of a separate import line, so it reads:

```ts
import { getExpiredMembershipStatDates, getFinanceStatDates, getMembershipExpiryStatus } from "./helpers";
```

Then append at the end of the file:

```ts

describe("getMembershipExpiryStatus", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("returns null when there is no end date", () => {
		expect(getMembershipExpiryStatus(null)).toBeNull();
	});

	it("labels a future end date as not yet expired", () => {
		vi.useFakeTimers();
		// Local midnight 2026-07-20 in the app's Africa/Nairobi (UTC+3) timezone.
		vi.setSystemTime(new Date("2026-07-19T21:00:00.000Z"));

		const status = getMembershipExpiryStatus("2026-07-25");

		expect(status).toEqual({ isExpired: false, label: "Expiring in 5 days" });
	});

	it("labels a past end date as expired", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-07-19T21:00:00.000Z"));

		const status = getMembershipExpiryStatus("2026-07-15");

		expect(status).toEqual({ isExpired: true, label: "Expired 5 days ago" });
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/features/dashboard/lib/helpers.test.ts`
Expected: FAIL — `getMembershipExpiryStatus` is not exported from `./helpers` (TypeScript/import error).

- [ ] **Step 3: Add the helper**

In `src/features/dashboard/lib/helpers.ts`, change the date-fns import (currently `import { addDays, endOfMonth, getDate, lastDayOfMonth, startOfMonth, subDays, subMonths } from "date-fns";`) to:

```ts
import {
	addDays,
	endOfMonth,
	formatDistanceToNow,
	getDate,
	lastDayOfMonth,
	startOfDay,
	startOfMonth,
	subDays,
	subMonths,
} from "date-fns";
```

Then append this function at the end of the file:

```ts

export function getMembershipExpiryStatus(
	rawEndDate: Date | string | null,
): { isExpired: boolean; label: string } | null {
	if (!rawEndDate) return null;

	const endDate =
		rawEndDate instanceof Date ? startOfDay(rawEndDate) : new Date(`${rawEndDate}T00:00:00`);
	const isExpired = endDate < startOfDay(new Date());

	return {
		isExpired,
		label: isExpired
			? `Expired ${formatDistanceToNow(endDate, { addSuffix: true })}`
			: `Expiring in ${formatDistanceToNow(endDate)}`,
	};
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/features/dashboard/lib/helpers.test.ts`
Expected: PASS (all `getMembershipExpiryStatus` cases plus the pre-existing ones in the file).

- [ ] **Step 5: Wire the helper into its original call site**

In `src/features/dashboard/components/expiring-soon.tsx`, change the top import line:

```ts
import { formatDistanceToNow, startOfDay } from "date-fns";
```

to:

```ts
import { getMembershipExpiryStatus } from "../lib/helpers";
```

(`formatDistanceToNow` and `startOfDay` are no longer used directly in this file after this change — do not keep them.)

Then replace this block inside `MemberActionItem` (currently lines 62-68):

```ts
	// const endDate = member.endDate ? new Date(`${member.endDate}T00:00:00`) : null;
	const endDate = !member.endDate
		? null
		: member.endDate instanceof Date
			? startOfDay(member.endDate)
			: new Date(`${member.endDate}T00:00:00`);
	const isExpired = endDate ? endDate < startOfDay(new Date()) : false;
```

with:

```ts
	const expiryStatus = getMembershipExpiryStatus(member.endDate);
```

And replace this block (currently lines 90-96):

```tsx
				{endDate && (
					<Badge variant={isExpired ? "danger" : "warning"}>
						{isExpired
							? `Expired ${formatDistanceToNow(endDate, { addSuffix: true })}`
							: `Expiring in ${formatDistanceToNow(endDate)}`}
					</Badge>
				)}
```

with:

```tsx
				{expiryStatus && (
					<Badge variant={expiryStatus.isExpired ? "danger" : "warning"}>
						{expiryStatus.label}
					</Badge>
				)}
```

- [ ] **Step 6: Run the full dashboard test suite, typecheck, and lint**

Run: `npx vitest run src/features/dashboard`, `npm run typecheck`, and `npx eslint src/features/dashboard/lib/helpers.ts src/features/dashboard/lib/helpers.test.ts src/features/dashboard/components/expiring-soon.tsx`
Expected: all PASS, no unused-import errors from `expiring-soon.tsx`.

- [ ] **Step 7: Commit**

```bash
git add src/features/dashboard/lib/helpers.ts src/features/dashboard/lib/helpers.test.ts src/features/dashboard/components/expiring-soon.tsx
git commit -m "extract shared membership expiry status helper"
```

---

### Task 2: Data layer — active memberships query, expiring memberships member number

**Files:**
- Modify: `src/features/dashboard/services/dashboard.api.ts:1-21, 139-173`
- Modify: `src/features/dashboard/services/queries.ts`

**Interfaces:**
- Consumes: none beyond existing `db`, `authMiddleware`, `requirePermission` already used in this file.
- Produces:
  - `getActiveMemberships` server function exported from `src/features/dashboard/services/dashboard.api.ts`, returning `Array<{ id: string; memberNo: number; fullName: string; activePlanName: string | null }>`.
  - `dashboardQueries.activeMemberships()` query option exported from `src/features/dashboard/services/queries.ts`, `queryKey: [...dashboardQueries.all, "active-memberships"]`.
  - `getExpiringMemberships`'s resolved rows gain a `memberNo: number` field (existing `id`, `memberName`, `planName`, `contact`, `image`, `endDate` fields are unchanged). Task 4 consumes this via `Awaited<ReturnType<typeof getExpiringMemberships>>[number]`.

- [ ] **Step 1: Add `asc` and `membersOverview` imports**

In `src/features/dashboard/services/dashboard.api.ts`, change:

```ts
import { and, avg, between, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import {
	attendanceLogs,
	attendanceOverview,
	memberMemberships,
	members,
	membershipPlans,
} from "@/drizzle/schema";
```

to:

```ts
import { and, asc, avg, between, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import {
	attendanceLogs,
	attendanceOverview,
	memberMemberships,
	members,
	membersOverview,
	membershipPlans,
} from "@/drizzle/schema";
```

- [ ] **Step 2: Add `memberNo` to `getExpiringMemberships`'s select**

In the same file, inside `getExpiringMemberships` (around line 142), change:

```ts
			.select({
				id: memberMemberships.id,
				memberName: sql<string>`${members.firstName} || ' ' || ${members.lastName}`,
				planName: membershipPlans.name,
				contact: members.contact,
				image: members.image,
				endDate: memberMemberships.endDate,
			})
```

to:

```ts
			.select({
				id: memberMemberships.id,
				memberNo: members.memberNo,
				memberName: sql<string>`${members.firstName} || ' ' || ${members.lastName}`,
				planName: membershipPlans.name,
				contact: members.contact,
				image: members.image,
				endDate: memberMemberships.endDate,
			})
```

- [ ] **Step 3: Add the `getActiveMemberships` server function**

In the same file, immediately after the closing of `getExpiringMemberships` (right before `export const getAverageAttendanceByDay = ...`), add:

```ts
export const getActiveMemberships = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		await requirePermission("dashboard:view");

		return db
			.select({
				id: membersOverview.id,
				memberNo: membersOverview.memberNo,
				fullName: membersOverview.fullName,
				activePlanName: membersOverview.activePlanName,
			})
			.from(membersOverview)
			.where(eq(membersOverview.memberStatus, "active"))
			.orderBy(asc(membersOverview.fullName));
	});
```

- [ ] **Step 4: Add the query option**

In `src/features/dashboard/services/queries.ts`, change the import:

```ts
import {
	dashboardStats,
	getAverageAttendanceByDay,
	getExpiredMemberships,
	getExpiringMemberships,
	getTodaysAttendances,
} from "@/features/dashboard/services/dashboard.api";
```

to:

```ts
import {
	dashboardStats,
	getActiveMemberships,
	getAverageAttendanceByDay,
	getExpiredMemberships,
	getExpiringMemberships,
	getTodaysAttendances,
} from "@/features/dashboard/services/dashboard.api";
```

Then add this query option to the `dashboardQueries` object, alongside `expiredMemberships`:

```ts
	activeMemberships: () =>
		queryOptions({
			queryKey: [...dashboardQueries.all, "active-memberships"],
			queryFn: () => getActiveMemberships(),
		}),
```

- [ ] **Step 5: Typecheck and lint**

Run: `npm run typecheck` and `npx eslint src/features/dashboard/services/dashboard.api.ts src/features/dashboard/services/queries.ts`
Expected: both PASS — no type or lint errors in `dashboard.api.ts` or `queries.ts`. (There is no unit-test harness for server functions in this codebase; correctness of the query itself is verified visually in Task 3/4 when the sheets are exercised in the browser.)

- [ ] **Step 6: Commit**

```bash
git add src/features/dashboard/services/dashboard.api.ts src/features/dashboard/services/queries.ts
git commit -m "add active memberships query and member number to expiring memberships query"
```

---

### Task 3: Active Members sheet

**Files:**
- Create: `src/features/dashboard/components/active-members-sheet.tsx`
- Modify: `src/features/dashboard/components/stat-cards.tsx`

**Interfaces:**
- Consumes: `dashboardQueries.activeMemberships()` (Task 2), `getActiveMemberships` type (Task 2), `DataTable` from `@/components/ui/datatable`, `TableSkeleton` from `@/components/ui/loaders`, `EmptyState` from `@/components/ui/empty`.
- Produces: `ActiveMembersSheet` component exported from `src/features/dashboard/components/active-members-sheet.tsx`, consumed by `stat-cards.tsx` in this same task.

- [ ] **Step 1: Create the sheet component**

Create `src/features/dashboard/components/active-members-sheet.tsx`:

```tsx
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Users2Icon } from "lucide-react";
import { DataTable } from "@/components/ui/datatable";
import { EmptyState } from "@/components/ui/empty";
import { TableSkeleton } from "@/components/ui/loaders";
import type { getActiveMemberships } from "@/features/dashboard/services/dashboard.api";
import { dashboardQueries } from "@/features/dashboard/services/queries";

type ActiveMembershipRow = Awaited<ReturnType<typeof getActiveMemberships>>[number];

const columns: Array<ColumnDef<ActiveMembershipRow>> = [
	{
		accessorKey: "fullName",
		header: "Member",
		cell: ({ row }) => (
			<span className="font-medium capitalize">{row.original.fullName}</span>
		),
	},
	{
		accessorKey: "memberNo",
		header: "Member No",
	},
	{
		accessorKey: "activePlanName",
		header: "Current Plan",
		cell: ({ row }) => (
			<span className="capitalize">{row.original.activePlanName ?? "—"}</span>
		),
	},
];

export function ActiveMembersSheet() {
	const {
		data: activeMemberships,
		isError,
		isLoading,
	} = useQuery(dashboardQueries.activeMemberships());

	if (isLoading) {
		return (
			<div className="p-4">
				<TableSkeleton rowCount={5} columnWidths={["w-36", "w-20", "w-28"]} />
			</div>
		);
	}

	if (isError) {
		return (
			<EmptyState
				icon={<Users2Icon />}
				title="Unable to load active members"
				description="Close the sheet and try again."
			/>
		);
	}

	if (!activeMemberships?.length) {
		return (
			<EmptyState
				icon={<Users2Icon />}
				title="No active members"
				description="There are no members with an active membership."
			/>
		);
	}

	return (
		<div className="p-4">
			<DataTable columns={columns} data={activeMemberships} />
		</div>
	);
}
```

- [ ] **Step 2: Wire it into the "Active Members" KPI card**

In `src/features/dashboard/components/stat-cards.tsx`, add this import alongside the existing `ExpiredMembershipsSheet` import (keep alphabetical order):

```ts
import { ActiveMembersSheet } from "@/features/dashboard/components/active-members-sheet";
```

Inside `StatCards`, add a new handler next to `showExpiredMemberships`:

```ts
	function showActiveMembers() {
		setOpen(<ActiveMembersSheet />, {
			title: "Active Members",
			description: "Members with an active membership.",
			className: "overflow-y-auto sm:max-w-xl!",
		});
	}
```

Then add `onViewDetails={showActiveMembers}` to the `"Active Members"` `KPICard`:

```tsx
			<KPICard
				title="Active Members"
				value={activeMembers.toLocaleString()}
				subtitle={` ${newMembersThisMonth === 0 ? "No new members this month" : newMembersThisMonth === 1 ? "1 new member this month" : `${newMembersThisMonth} new members this month`}`}
				icon={Users2Icon}
				trend={percentageChangeCalculator(
					newMembersThisMonth,
					newMembersLastMonth,
				)}
				variant="default"
				onViewDetails={showActiveMembers}
			/>
```

- [ ] **Step 3: Typecheck and lint**

Run: `npm run typecheck` and `npx eslint src/features/dashboard/components/active-members-sheet.tsx src/features/dashboard/components/stat-cards.tsx`
Expected: both PASS.

- [ ] **Step 4: Manual verification in the browser**

Run: `npm run dev`, sign in, open `/app/dashboard`.
- Click "View Details" on the "Active Members" card.
- Expected: a sheet titled "Active Members" opens, showing a paginated table with Member, Member No, and Current Plan columns, populated with active members. Pagination controls ("Rows per page", page indicator, prev/next buttons) work.
- If there are no active members in the seeded/dev database, confirm the "No active members" empty state renders instead.

- [ ] **Step 5: Commit**

```bash
git add src/features/dashboard/components/active-members-sheet.tsx src/features/dashboard/components/stat-cards.tsx
git commit -m "add view details sheet to active members card"
```

---

### Task 4: Expiring Soon sheet

**Files:**
- Create: `src/features/dashboard/components/expiring-soon-sheet.tsx`
- Modify: `src/features/dashboard/components/stat-cards.tsx`

**Interfaces:**
- Consumes: `dashboardQueries.expiringMemberships()` (existing, now returning `memberNo` per Task 2), `getExpiringMemberships` type (Task 2), `getMembershipExpiryStatus` from `@/features/dashboard/lib/helpers` (Task 1), `DataTable`, `TableSkeleton`, `EmptyState`.
- Produces: `ExpiringSoonSheet` component exported from `src/features/dashboard/components/expiring-soon-sheet.tsx`, consumed by `stat-cards.tsx` in this same task.

- [ ] **Step 1: Create the sheet component**

Create `src/features/dashboard/components/expiring-soon-sheet.tsx`:

```tsx
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { CalendarClockIcon } from "lucide-react";
import { DataTable } from "@/components/ui/datatable";
import { EmptyState } from "@/components/ui/empty";
import { TableSkeleton } from "@/components/ui/loaders";
import { getMembershipExpiryStatus } from "@/features/dashboard/lib/helpers";
import type { getExpiringMemberships } from "@/features/dashboard/services/dashboard.api";
import { dashboardQueries } from "@/features/dashboard/services/queries";

type ExpiringMembershipRow = Awaited<ReturnType<typeof getExpiringMemberships>>[number];

const columns: Array<ColumnDef<ExpiringMembershipRow>> = [
	{
		accessorKey: "memberName",
		header: "Member",
		cell: ({ row }) => (
			<span className="font-medium capitalize">{row.original.memberName}</span>
		),
	},
	{
		accessorKey: "memberNo",
		header: "Member No",
	},
	{
		accessorKey: "planName",
		header: "Current Plan",
		cell: ({ row }) => (
			<span className="capitalize">{row.original.planName ?? "—"}</span>
		),
	},
	{
		id: "daysRemaining",
		header: "Days Remaining",
		cell: ({ row }) => getMembershipExpiryStatus(row.original.endDate)?.label ?? "—",
	},
];

export function ExpiringSoonSheet() {
	const {
		data: expiringMemberships,
		isError,
		isLoading,
	} = useQuery(dashboardQueries.expiringMemberships());

	if (isLoading) {
		return (
			<div className="p-4">
				<TableSkeleton rowCount={5} columnWidths={["w-36", "w-20", "w-28", "w-32"]} />
			</div>
		);
	}

	if (isError) {
		return (
			<EmptyState
				icon={<CalendarClockIcon />}
				title="Unable to load expiring memberships"
				description="Close the sheet and try again."
			/>
		);
	}

	if (!expiringMemberships?.length) {
		return (
			<EmptyState
				icon={<CalendarClockIcon />}
				title="No expiring memberships"
				description="No memberships are expiring soon."
			/>
		);
	}

	return (
		<div className="p-4">
			<DataTable columns={columns} data={expiringMemberships} />
		</div>
	);
}
```

- [ ] **Step 2: Wire it into the "Expiring Soon" KPI card**

In `src/features/dashboard/components/stat-cards.tsx`, add this import alongside the other sheet imports (keep alphabetical order — it sorts after `ExpiredMembershipsSheet`):

```ts
import { ExpiringSoonSheet } from "@/features/dashboard/components/expiring-soon-sheet";
```

Inside `StatCards`, add a new handler next to `showActiveMembers`/`showExpiredMemberships`:

```ts
	function showExpiringSoon() {
		setOpen(<ExpiringSoonSheet />, {
			title: "Expiring Soon",
			description:
				"Memberships expiring within 7 days, including recently expired plans awaiting renewal.",
			className: "overflow-y-auto sm:max-w-xl!",
		});
	}
```

Then add `onViewDetails={showExpiringSoon}` to the `"Expiring Soon"` `KPICard`:

```tsx
			<KPICard
				title="Expiring Soon"
				value={expiringMemberships}
				subtitle={
					expiringMemberships === 0
						? "No expiring memberships"
						: expiringMemberships === 1
							? "1 expiring membership"
							: `${expiringMemberships} expiring memberships`
				}
				icon={CalendarClockIcon}
				variant="default"
				onViewDetails={showExpiringSoon}
			/>
```

Note: the destructured `expiringMemberships` from `useSuspenseQuery(dashboardQueries.stats())` (the KPI count) and the new `showExpiringSoon` handler name are distinct identifiers — no collision.

- [ ] **Step 3: Typecheck and lint**

Run: `npm run typecheck` and `npx eslint src/features/dashboard/components/expiring-soon-sheet.tsx src/features/dashboard/components/stat-cards.tsx`
Expected: both PASS.

- [ ] **Step 4: Manual verification in the browser**

Run: `npm run dev` (if not already running), open `/app/dashboard`.
- Click "View Details" on the "Expiring Soon" card.
- Expected: a sheet titled "Expiring Soon" opens, showing a paginated table with Member, Member No, Current Plan, and Days Remaining columns. Days Remaining shows "Expiring in N days" for upcoming end dates and "Expired N days ago" for recently-lapsed ones, matching the phrasing already used in the "Membership Actions Needed" widget on the same dashboard.
- If there are no expiring memberships, confirm the "No expiring memberships" empty state renders instead.
- Also re-check the "Membership Actions Needed" widget still renders its badges correctly (regression check for the Task 1 refactor).

- [ ] **Step 5: Run the full test suite**

Run: `npm run test` and `npm run typecheck`
Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/dashboard/components/expiring-soon-sheet.tsx src/features/dashboard/components/stat-cards.tsx
git commit -m "add view details sheet to expiring soon card"
```
