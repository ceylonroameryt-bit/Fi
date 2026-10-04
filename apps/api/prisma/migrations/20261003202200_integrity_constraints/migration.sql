-- Accounting integrity constraints that Prisma's schema language cannot express.
-- These are the last line of defence behind the application-level validation.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ───────────── Users ─────────────
ALTER TABLE "users" ADD CONSTRAINT "users_email_lowercase_chk" CHECK ("email" = lower("email"));

-- ───────────── Organisations ─────────────
ALTER TABLE "organizations"
  ADD CONSTRAINT "organizations_fy_start_month_chk" CHECK ("financial_year_start_month" BETWEEN 1 AND 12),
  ADD CONSTRAINT "organizations_fy_start_day_chk" CHECK ("financial_year_start_day" BETWEEN 1 AND 31),
  ADD CONSTRAINT "organizations_base_currency_chk" CHECK ("base_currency" ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT "organizations_country_chk" CHECK ("country" ~ '^[A-Z]{2}$');

-- ───────────── Accounts ─────────────
ALTER TABLE "accounts"
  ADD CONSTRAINT "accounts_code_format_chk" CHECK ("code" ~ '^[0-9A-Za-z][0-9A-Za-z.\-]{0,19}$'),
  ADD CONSTRAINT "accounts_not_own_parent_chk" CHECK ("parent_account_id" IS NULL OR "parent_account_id" <> "id"),
  ADD CONSTRAINT "accounts_normal_balance_chk" CHECK (
    ("account_type" IN ('ASSET', 'EXPENSE') AND "normal_balance" = 'DEBIT') OR
    ("account_type" IN ('LIABILITY', 'EQUITY', 'REVENUE') AND "normal_balance" = 'CREDIT')
  );

-- ───────────── Financial years & periods ─────────────
ALTER TABLE "financial_years"
  ADD CONSTRAINT "financial_years_dates_chk" CHECK ("start_date" <= "end_date"),
  ADD CONSTRAINT "financial_years_no_overlap_excl"
    EXCLUDE USING gist ("organization_id" WITH =, daterange("start_date", "end_date", '[]') WITH &&);

ALTER TABLE "accounting_periods"
  ADD CONSTRAINT "accounting_periods_dates_chk" CHECK ("start_date" <= "end_date"),
  ADD CONSTRAINT "accounting_periods_no_overlap_excl"
    EXCLUDE USING gist ("organization_id" WITH =, daterange("start_date", "end_date", '[]') WITH &&);

-- ───────────── Journals ─────────────
ALTER TABLE "journal_entries"
  ADD CONSTRAINT "journal_entries_exchange_rate_chk" CHECK ("exchange_rate" > 0),
  ADD CONSTRAINT "journal_entries_currency_chk" CHECK ("currency" ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT "journal_entries_posted_fields_chk" CHECK (
    "status" NOT IN ('POSTED', 'REVERSED') OR ("posted_at" IS NOT NULL AND "posted_by" IS NOT NULL)
  );

ALTER TABLE "journal_lines"
  ADD CONSTRAINT "journal_lines_non_negative_chk" CHECK ("debit" >= 0 AND "credit" >= 0),
  ADD CONSTRAINT "journal_lines_exchange_rate_chk" CHECK ("exchange_rate" > 0),
  ADD CONSTRAINT "journal_lines_line_number_chk" CHECK ("line_number" > 0);

-- Posted / reversed journals (and their lines) are immutable history: never deleted.
CREATE OR REPLACE FUNCTION ledgerline_prevent_posted_journal_delete() RETURNS trigger AS $$
BEGIN
  IF OLD."status" IN ('POSTED', 'REVERSED') THEN
    RAISE EXCEPTION 'Posted or reversed journal % cannot be deleted', OLD."journal_number"
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "journal_entries_prevent_posted_delete"
  BEFORE DELETE ON "journal_entries"
  FOR EACH ROW EXECUTE FUNCTION ledgerline_prevent_posted_journal_delete();

CREATE OR REPLACE FUNCTION ledgerline_prevent_posted_line_change() RETURNS trigger AS $$
DECLARE
  journal_status TEXT;
BEGIN
  SELECT "status" INTO journal_status FROM "journal_entries"
    WHERE "id" = COALESCE(OLD."journal_entry_id", NEW."journal_entry_id");
  IF journal_status IN ('POSTED', 'REVERSED') THEN
    RAISE EXCEPTION 'Lines of a posted or reversed journal are immutable'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "journal_lines_prevent_posted_change"
  BEFORE UPDATE OR DELETE ON "journal_lines"
  FOR EACH ROW EXECUTE FUNCTION ledgerline_prevent_posted_line_change();

-- ───────────── Audit log: append-only ─────────────
CREATE OR REPLACE FUNCTION ledgerline_audit_logs_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only' USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "audit_logs_append_only"
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION ledgerline_audit_logs_append_only();
