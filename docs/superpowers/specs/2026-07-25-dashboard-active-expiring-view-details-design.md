# Dashboard Active Members & Expiring Soon View Details

## Goal

Give the "Active Members" and "Expiring Soon" KPI cards on the membership dashboard the same "View Details" affordance the "Expired Memberships" card already has, opening a sheet with the relevant member list. Unlike the expired-memberships sheet (a plain `Table`), both new sheets use the app's `DataTable` component so they get built-in client-side pagination for free.

Out of scope: any "Stop membership" action. This design is display-only.

## Active Members Sheet

**Data:** New server function `getActiveMemberships` in `src/features/dashboard/services/dashboard.api.ts`. Queries `membersOverview` (`vw_member_overview`) for rows where `memberStatus = "active"`, selecting `id`, `memberNo`, `fullName`, `activePlanName`. Ordered by `fullName` ascending. Gated by `authMiddleware` + `requirePermission("dashboard:view")`, consistent with the other dashboard queries in the file.

**Query option:** `dashboardQueries.activeMemberships()` added to `src/features/dashboard/services/queries.ts`, following the same `queryOptions` pattern as `expiredMemberships()`.

**Component:** New `ActiveMembersSheet` in `src/features/dashboard/components/active-members-sheet.tsx`, modeled on `ExpiredMembershipsSheet` (loading/error/empty states via `TableSkeleton` / `EmptyState`) but rendering a `DataTable` instead of a plain `Table`. Columns:

| Column | Source |
|---|---|
| Member | `fullName` |
| Member No | `memberNo` |
| Current Plan | `activePlanName` (fall back to `"—"` if null) |

## Expiring Soon Sheet

**Data:** Reuse the existing `getExpiringMemberships` server function — no new query. It already selects the correct 7-days-ago-through-7-days-ahead window used by the "Membership Actions Needed" widget. Add `memberNo: members.memberNo` to its existing `select`, since the new sheet needs it and the current consumer doesn't.

**Component:** New `ExpiringSoonSheet` in `src/features/dashboard/components/expiring-soon-sheet.tsx`, using `dashboardQueries.expiringMemberships()` (already exists) and rendering a `DataTable`. Columns:

| Column | Source |
|---|---|
| Member | `memberName` |
| Member No | `memberNo` |
| Current Plan | `planName` (fall back to `"—"` if null) |
| Days Remaining | Derived from `endDate`, phrased the same way `MemberActionItem` in `expiring-soon.tsx` phrases it today: `"Expires in N days"` for future end dates, `"Expired N days ago"` for past end dates. Extract this phrasing into a small shared helper so both places compute it identically, rather than duplicating the logic. |

## Stat Card Wiring

In `src/features/dashboard/components/stat-cards.tsx`:

- Add `showActiveMembers` and `showExpiringSoon` handlers alongside the existing `showExpiredMemberships`, each calling `setOpen(...)` with the corresponding sheet component.
  - Active Members: title `"Active Members"`, description `"Members with an active membership."`
  - Expiring Soon: title `"Expiring Soon"`, description `"Memberships expiring within 7 days, including recently expired plans awaiting renewal."`
- Pass `onViewDetails={showActiveMembers}` to the `"Active Members"` `KPICard` and `onViewDetails={showExpiringSoon}` to the `"Expiring Soon"` `KPICard`.
- No changes to `KPICard` itself — it already supports `onViewDetails`.
- No changes to `expiring-soon.tsx` (the "Membership Actions Needed" widget) beyond extracting the shared days-remaining phrasing helper described above.

## Testing

- Unit test for the new days-remaining helper: future date → "Expires in N days", past date → "Expired N days ago", today → sensible boundary case.
- Manual verification in the browser: open both new sheets from the dashboard, confirm data, pagination, and empty states render correctly.
- Run TypeScript type checking (`npm run typecheck`) and scoped ESLint checks for touched files (this repo uses ESLint, not Biome).
