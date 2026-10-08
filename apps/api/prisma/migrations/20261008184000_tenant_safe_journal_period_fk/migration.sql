-- Enforce Tenant Isolation: Composite Foreign Key on JournalEntry -> AccountingPeriod

-- 1. Safely disconnect any invalid historical cross-tenant journal period references
UPDATE "journal_entries" j
SET "period_id" = NULL
FROM "accounting_periods" p
WHERE j."period_id" = p."id"
  AND j."organization_id" != p."organization_id";

-- 2. Drop legacy single-column FK and index
ALTER TABLE "journal_entries" DROP CONSTRAINT IF EXISTS "journal_entries_period_id_fkey";
DROP INDEX IF EXISTS "journal_entries_period_id_idx";

-- 3. Add composite tenant-safe FK and index
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_organization_id_period_id_fkey"
    FOREIGN KEY ("organization_id", "period_id")
    REFERENCES "accounting_periods"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "journal_entries_organization_id_period_id_idx"
    ON "journal_entries"("organization_id", "period_id");
