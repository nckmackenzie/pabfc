# Multi-Period Credit Proration Design

## Scope

Correct the suggested credit-note amount for memberships purchased for more than one period. The member-access and receipt-eligibility review suggestion is explicitly out of scope.

## Current Behavior

Receipt finalization calculates the membership end date using the plan duration multiplied by `payment.numberOfPeriods`, and `priceCharged` contains the member's full charge across those periods. Credit-note eligibility currently divides that full charge by only one plan duration, which overstates the daily rate and suggested credit for multi-period purchases.

## Design

Use the total purchased duration as the proration denominator:

`totalDurationDays = membershipPlan.duration * payment.numberOfPeriods`

`dailyRate = priceCharged / totalDurationDays`

`suggestedAmount = min(dailyRate * unusedDays, priceCharged)`

The pure `computeSuggestedCreditAmount` helper will accept the total purchased duration rather than a single plan duration. `checkCreditNoteEligibility` will derive that value from the originating payment and membership plan before calling the helper.

This matches the existing receipt pricing and membership-end-date calculation. It avoids date-span boundary ambiguity and requires no database change because `payments.numberOfPeriods` is authoritative and non-null.

## Validation and Error Handling

Existing validation remains unchanged. Payment periods are already validated as positive when receipts are created and the database column is non-null with a default of one. Existing credit capping continues to prevent a suggestion above `priceCharged`.

## Tests

Add focused unit coverage to the existing eligibility test file:

- A two-period, 30-day plan charged at KES 6,000 with 30 unused days suggests KES 3,000.
- Existing single-period proration remains unchanged.
- Existing capping and precision behavior remain green.

Run the focused eligibility tests, TypeScript type checking, and a scoped formatting check for touched files.
