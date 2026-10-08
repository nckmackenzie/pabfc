-- Migration 0096 originally created wht_corrections.treatment_account_id
-- (NOT NULL) and was later hand-edited, before any deploy was known to have
-- run it, to post against accounts_payable instead. Any environment that
-- ran db:migrate against the original 0096 still carries the stale column
-- with its NOT NULL constraint, which breaks every insert now that the
-- application never sets it. Safe no-op where the column is already gone.
ALTER TABLE "wht_corrections" DROP COLUMN IF EXISTS "treatment_account_id";
