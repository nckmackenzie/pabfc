# Payment Post-Commit Dispatch

## Goal

Prevent failures in payment post-commit activity logging or Inngest dispatch from reporting a committed bill payment as failed.

## Verified Finding

`createPayment` commits its database transaction before calling `logActivity` and `inngest.send`, but both calls remain inside the transaction's outer `try` block. If either call rejects, the outer catch returns `Failed to create/update payment` even though the payment, lines, journal entry, and banking entry are already committed. A client retry can then create a duplicate payment.

## Design

Add a small payment-specific post-commit dispatcher that:

- invokes activity logging and invoice-status event dispatch independently;
- catches and reports each rejection without rethrowing;
- allows both operations to run even if one fails; and
- resolves after both attempts so `createPayment` returns the committed success result.

The transaction and its existing failure handling remain unchanged. After the transaction commits, `createPayment` calls the non-throwing dispatcher and returns `success(undefined)`.

## Scope Decision

A transactional outbox would provide stronger delivery guarantees, but the repository has no existing outbox schema, worker, or retry policy. Adding that infrastructure is outside this single review finding. The existing Inngest event remains the retryable downstream boundary once accepted by Inngest; dispatch failures are reported for operational follow-up without changing the committed payment response.

## Testing

Add focused unit coverage proving:

- a rejected activity-log operation does not reject the dispatcher and does not prevent event dispatch;
- a rejected event dispatch does not reject the dispatcher; and
- both operations are attempted exactly once.

Run the focused Vitest test, TypeScript type checking, formatting checks, and the full test suite.
