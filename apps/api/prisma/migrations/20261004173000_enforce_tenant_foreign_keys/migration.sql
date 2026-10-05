-- Enforce Tenant Isolation: Composite Foreign Keys
-- Phase 1: Accounts parent hierarchy must strictly belong to the same organisation
-- Phase 2: Contacts receivable and payable accounts must strictly belong to the same organisation

-- 1. Safely disconnect any invalid historical cross-tenant account parent references
UPDATE "accounts" a
SET "parent_account_id" = NULL
FROM "accounts" p
WHERE a."parent_account_id" = p."id"
  AND a."organization_id" != p."organization_id";

-- Drop legacy single-column parent FK and index
ALTER TABLE "accounts" DROP CONSTRAINT IF EXISTS "accounts_parent_account_id_fkey";
DROP INDEX IF EXISTS "accounts_parent_account_id_idx";

-- Create composite parent FK and index
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_organization_id_parent_account_id_fkey"
    FOREIGN KEY ("organization_id", "parent_account_id")
    REFERENCES "accounts"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "accounts_organization_id_parent_account_id_idx"
    ON "accounts"("organization_id", "parent_account_id");

-- 2. Safely disconnect any invalid cross-tenant contact account references
UPDATE "contacts" c
SET "receivable_account_id" = NULL
FROM "accounts" a
WHERE c."receivable_account_id" = a."id"
  AND c."organization_id" != a."organization_id";

UPDATE "contacts" c
SET "payable_account_id" = NULL
FROM "accounts" a
WHERE c."payable_account_id" = a."id"
  AND c."organization_id" != a."organization_id";

-- Create composite foreign keys for Contact accounts
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_organization_id_receivable_account_id_fkey"
    FOREIGN KEY ("organization_id", "receivable_account_id")
    REFERENCES "accounts"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "contacts" ADD CONSTRAINT "contacts_organization_id_payable_account_id_fkey"
    FOREIGN KEY ("organization_id", "payable_account_id")
    REFERENCES "accounts"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "contacts_organization_id_receivable_account_id_idx"
    ON "contacts"("organization_id", "receivable_account_id");

CREATE INDEX IF NOT EXISTS "contacts_organization_id_payable_account_id_idx"
    ON "contacts"("organization_id", "payable_account_id");
