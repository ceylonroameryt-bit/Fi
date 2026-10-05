-- Forward migration: Financial integrity, atomic invoice posting, and posted journal protection

-- 1. Idempotency & Unique Source Relationship
-- Ensures an invoice (or any source entity) can never produce more than one journal entry.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_journal_entries_org_source"
  ON "journal_entries" ("organization_id", "source_type", "source_id")
  WHERE "source_id" IS NOT NULL;

-- 2. Tenant-safe Invoice -> Journal Foreign Key
-- Guarantees an invoice can never link to a journal of another organisation.
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_organization_id_journal_entry_id_key"
  ON "invoices"("organization_id", "journal_entry_id");

ALTER TABLE "invoices"
  DROP CONSTRAINT IF EXISTS "invoices_journal_entry_id_fkey";

ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_org_journal_entry_fk"
  FOREIGN KEY ("organization_id", "journal_entry_id")
  REFERENCES "journal_entries"("organization_id", "id")
  ON DELETE RESTRICT;

-- 3. Tenant-safe Journal Reversal Foreign Key
-- Guarantees a journal reversal can never link across tenant boundaries.
CREATE UNIQUE INDEX IF NOT EXISTS "journal_entries_organization_id_reversed_by_journal_id_key"
  ON "journal_entries"("organization_id", "reversed_by_journal_id");

ALTER TABLE "journal_entries"
  DROP CONSTRAINT IF EXISTS "journal_entries_reversed_by_journal_id_fkey";

ALTER TABLE "journal_entries"
  ADD CONSTRAINT "journal_entries_org_reversed_by_fk"
  FOREIGN KEY ("organization_id", "reversed_by_journal_id")
  REFERENCES "journal_entries"("organization_id", "id")
  ON DELETE RESTRICT;

-- 4. Complete Journal Line Immutability Trigger
-- Blocks INSERT, UPDATE, DELETE, and reassignment on lines belonging to POSTED or REVERSED journals.
DROP TRIGGER IF EXISTS "journal_lines_prevent_posted_change" ON "journal_lines";

CREATE OR REPLACE FUNCTION ledgerline_prevent_posted_line_change() RETURNS trigger AS $$
DECLARE
  target_journal_id UUID;
  journal_status TEXT;
BEGIN
  target_journal_id := COALESCE(NEW."journal_entry_id", OLD."journal_entry_id");

  SELECT "status" INTO journal_status
  FROM "journal_entries"
  WHERE "id" = target_journal_id;

  IF journal_status IN ('POSTED', 'REVERSED') THEN
    RAISE EXCEPTION 'Lines of a posted or reversed journal are immutable'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW."journal_entry_id" <> OLD."journal_entry_id" THEN
      RAISE EXCEPTION 'Cannot reassign a journal line to a different journal'
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF NEW."organization_id" <> OLD."organization_id" THEN
      RAISE EXCEPTION 'Cannot reassign a journal line to a different organisation'
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "journal_lines_prevent_posted_change"
  BEFORE INSERT OR UPDATE OR DELETE ON "journal_lines"
  FOR EACH ROW EXECUTE FUNCTION ledgerline_prevent_posted_line_change();

-- 5. Posted/Reversed Journal Header Protection Trigger
-- Prevents a POSTED journal from reverting to DRAFT/VALIDATED, prevents REVERSED from changing,
-- and locks critical financial header attributes.
CREATE OR REPLACE FUNCTION ledgerline_protect_posted_journal_header() RETURNS trigger AS $$
BEGIN
  IF OLD."status" = 'POSTED' AND NEW."status" NOT IN ('POSTED', 'REVERSED') THEN
    RAISE EXCEPTION 'Posted journal % cannot be transitioned back to %', OLD."journal_number", NEW."status"
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  IF OLD."status" = 'REVERSED' AND NEW."status" <> 'REVERSED' THEN
    RAISE EXCEPTION 'Reversed journal % cannot change status', OLD."journal_number"
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  IF OLD."status" IN ('POSTED', 'REVERSED') THEN
    IF NEW."organization_id" <> OLD."organization_id" OR
       NEW."journal_number" <> OLD."journal_number" OR
       NEW."journal_date" <> OLD."journal_date" OR
       NEW."posting_date" <> OLD."posting_date" OR
       NEW."currency" <> OLD."currency" THEN
      RAISE EXCEPTION 'Header attributes of posted/reversed journal % are immutable', OLD."journal_number"
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "journal_entries_protect_header" ON "journal_entries";
CREATE TRIGGER "journal_entries_protect_header"
  BEFORE UPDATE ON "journal_entries"
  FOR EACH ROW EXECUTE FUNCTION ledgerline_protect_posted_journal_header();

-- 6. Deferred Constraint Trigger: Enforce Double-Entry Balance and Line Structure at Commit
CREATE OR REPLACE FUNCTION ledgerline_enforce_posted_journal_balance() RETURNS trigger AS $$
DECLARE
  total_debit NUMERIC(19, 4);
  total_credit NUMERIC(19, 4);
  line_count INT;
BEGIN
  IF NEW."status" = 'POSTED' THEN
    SELECT COALESCE(SUM("debit"), 0), COALESCE(SUM("credit"), 0), COUNT(*)
    INTO total_debit, total_credit, line_count
    FROM "journal_lines"
    WHERE "journal_entry_id" = NEW."id";

    IF line_count < 2 THEN
      RAISE EXCEPTION 'Posted journal % must have at least 2 lines (found %)', NEW."journal_number", line_count
        USING ERRCODE = 'check_violation';
    END IF;

    IF total_debit <> total_credit THEN
      RAISE EXCEPTION 'Posted journal % is unbalanced: debits (%) != credits (%)', NEW."journal_number", total_debit, total_credit
        USING ERRCODE = 'check_violation';
    END IF;

    IF total_debit <= 0 THEN
      RAISE EXCEPTION 'Posted journal % must have positive total debit and credit', NEW."journal_number"
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "journal_entries_enforce_posted_balance" ON "journal_entries";
CREATE CONSTRAINT TRIGGER "journal_entries_enforce_posted_balance"
  AFTER INSERT OR UPDATE ON "journal_entries"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION ledgerline_enforce_posted_journal_balance();
