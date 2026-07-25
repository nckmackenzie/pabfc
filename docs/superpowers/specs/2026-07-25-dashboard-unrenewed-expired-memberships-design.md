# Dashboard Unrenewed Expired Memberships

## Goal

Make the dashboard's expired-membership count and detail list show only members whose membership expired within the rolling last 30 days and who have not subsequently renewed.

## Business Rule

An expired membership is eligible when:

- its status is `expired`;
- its end date is within the existing rolling 30-day window, inclusive;
- its member has not been deleted; and
- the same member has no membership with a later start date whose status is `active` or `pending`.

A later membership in any other status, including `cancelled`, `terminated`, or `expired`, does not count as a valid renewal and therefore does not exclude the earlier expiration.

## Design

Extend the shared expired-membership query conditions in `src/features/dashboard/services/dashboard.api.ts` with a correlated SQL `NOT EXISTS` condition. The subquery will look for another membership belonging to the same member, starting later than the candidate expired membership, with status `active` or `pending`.

Both `dashboardStats` and `getExpiredMemberships` already consume the shared conditions. Keeping the renewal exclusion there ensures the summary count and detail list apply exactly the same rule.

The existing date window, deleted-member exclusion, permissions, detail columns, and result ordering remain unchanged.

## Testing

Add focused regression coverage for the shared rule:

- a later `active` membership excludes the expired membership;
- a later `pending` membership excludes the expired membership;
- a later membership with a non-valid status such as `cancelled` does not exclude it; and
- no later membership leaves it eligible.

Run the targeted Vitest test, TypeScript type checking, and scoped Biome checks for touched files.
