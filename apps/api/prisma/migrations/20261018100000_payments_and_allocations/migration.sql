-- Migration: 20261018100000_payments_and_allocations
-- Adds: payments, payment_allocations, credit_notes, credit_note_lines,
--       bank_accounts, bank_statement_imports, bank_statement_lines, bank_rules

-- Payment kinds
CREATE TYPE "PaymentKind" AS ENUM (
  'CUSTOMER_RECEIPT',
  'SUPPLIER_PAYMENT',
  'CUSTOMER_REFUND',
  'SUPPLIER_REFUND'
);

CREATE TYPE "PaymentStatus" AS ENUM (
  'POSTED',
  'VOIDED'
);

CREATE TYPE "CreditNoteStatus" AS ENUM (
  'DRAFT',
  'POSTED',
  'VOIDED'
);

CREATE TYPE "CreditNoteKind" AS ENUM (
  'SALES_CREDIT_NOTE',
  'SUPPLIER_CREDIT_NOTE'
);

CREATE TYPE "AllocationSourceType" AS ENUM (
  'PAYMENT',
  'CREDIT_NOTE'
);

CREATE TYPE "AllocationTargetType" AS ENUM (
  'INVOICE',
  'BILL'
);

CREATE TYPE "BankAccountStatus" AS ENUM (
  'ACTIVE',
  'ARCHIVED'
);

CREATE TYPE "StatementImportStatus" AS ENUM (
  'PENDING',
  'IMPORTED',
  'FAILED'
);

CREATE TYPE "StatementFileFormat" AS ENUM (
  'CSV',
  'OFX',
  'QIF'
);

CREATE TYPE "BankTransactionStatus" AS ENUM (
  'UNMATCHED',
  'MATCHED',
  'CATEGORISED',
  'EXCLUDED'
);

CREATE TYPE "BankRuleMatchField" AS ENUM (
  'DESCRIPTION',
  'PAYEE',
  'REFERENCE',
  'AMOUNT_EXACT',
  'AMOUNT_RANGE'
);

CREATE TYPE "BankRuleMatchType" AS ENUM (
  'CONTAINS',
  'EQUALS',
  'STARTS_WITH',
  'REGEX'
);

-- Payments
CREATE TABLE "payments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "kind" "PaymentKind" NOT NULL,
  "contact_id" UUID NOT NULL,
  "bank_account_nominal_id" UUID,
  "payment_date" DATE NOT NULL,
  "amount" DECIMAL(19,4) NOT NULL CHECK ("amount" > 0),
  "currency" CHAR(3) NOT NULL DEFAULT 'GBP',
  "reference" VARCHAR(100),
  "notes" VARCHAR(500),
  "status" "PaymentStatus" NOT NULL DEFAULT 'POSTED',
  "journal_entry_id" UUID UNIQUE,
  "amount_allocated" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_by" UUID,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "voided_by" UUID,
  "voided_at" TIMESTAMP(3),
  "void_reason" VARCHAR(255),
  CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "payments_organization_id_id_key" ON "payments"("organization_id", "id");
CREATE INDEX "payments_org_kind_idx" ON "payments"("organization_id", "kind");
CREATE INDEX "payments_org_contact_idx" ON "payments"("organization_id", "contact_id");
CREATE INDEX "payments_org_date_idx" ON "payments"("organization_id", "payment_date");
CREATE INDEX "payments_org_status_idx" ON "payments"("organization_id", "status");

-- Payment allocations
CREATE TABLE "payment_allocations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "source_type" "AllocationSourceType" NOT NULL,
  "payment_id" UUID,
  "credit_note_id" UUID,
  "target_type" "AllocationTargetType" NOT NULL,
  "invoice_id" UUID,
  "bill_id" UUID,
  "amount" DECIMAL(19,4) NOT NULL CHECK ("amount" > 0),
  "allocation_date" DATE NOT NULL,
  "is_reversed" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_allocations_source_chk" CHECK (
    ("source_type" = 'PAYMENT' AND "payment_id" IS NOT NULL AND "credit_note_id" IS NULL)
    OR ("source_type" = 'CREDIT_NOTE' AND "credit_note_id" IS NOT NULL AND "payment_id" IS NULL)
  ),
  CONSTRAINT "payment_allocations_target_chk" CHECK (
    ("target_type" = 'INVOICE' AND "invoice_id" IS NOT NULL AND "bill_id" IS NULL)
    OR ("target_type" = 'BILL' AND "bill_id" IS NOT NULL AND "invoice_id" IS NULL)
  )
);
CREATE INDEX "pa_payment_idx" ON "payment_allocations"("payment_id") WHERE "payment_id" IS NOT NULL;
CREATE INDEX "pa_credit_note_idx" ON "payment_allocations"("credit_note_id") WHERE "credit_note_id" IS NOT NULL;
CREATE INDEX "pa_invoice_idx" ON "payment_allocations"("invoice_id") WHERE "invoice_id" IS NOT NULL;
CREATE INDEX "pa_bill_idx" ON "payment_allocations"("bill_id") WHERE "bill_id" IS NOT NULL;
CREATE INDEX "pa_org_idx" ON "payment_allocations"("organization_id");

-- Credit notes
CREATE TABLE "credit_notes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "kind" "CreditNoteKind" NOT NULL,
  "contact_id" UUID NOT NULL,
  "credit_note_number" VARCHAR(30) NOT NULL,
  "reference" VARCHAR(100),
  "issue_date" DATE NOT NULL,
  "currency" CHAR(3) NOT NULL DEFAULT 'GBP',
  "subtotal" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "tax_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "total_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "amount_allocated" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "status" "CreditNoteStatus" NOT NULL DEFAULT 'DRAFT',
  "related_invoice_id" UUID,
  "related_bill_id" UUID,
  "journal_entry_id" UUID UNIQUE,
  "notes" VARCHAR(1000),
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_by" UUID,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "posted_by" UUID,
  "posted_at" TIMESTAMP(3),
  "voided_by" UUID,
  "voided_at" TIMESTAMP(3),
  "void_reason" VARCHAR(255),
  CONSTRAINT "credit_notes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "credit_notes_org_number_key" ON "credit_notes"("organization_id", "credit_note_number");
CREATE UNIQUE INDEX "credit_notes_org_id_key" ON "credit_notes"("organization_id", "id");
CREATE INDEX "credit_notes_org_kind_idx" ON "credit_notes"("organization_id", "kind");
CREATE INDEX "credit_notes_org_contact_idx" ON "credit_notes"("organization_id", "contact_id");
CREATE INDEX "credit_notes_org_status_idx" ON "credit_notes"("organization_id", "status");

CREATE TABLE "credit_note_lines" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "credit_note_id" UUID NOT NULL,
  "line_number" SMALLINT NOT NULL,
  "account_id" UUID NOT NULL,
  "description" VARCHAR(255) NOT NULL,
  "quantity" DECIMAL(19,4),
  "unit_price" DECIMAL(19,4),
  "net_amount" DECIMAL(19,4) NOT NULL,
  "tax_code_id" UUID,
  "tax_rate" DECIMAL(7,4) NOT NULL DEFAULT 0,
  "tax_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "line_total" DECIMAL(19,4) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "credit_note_lines_pkey" PRIMARY KEY ("id"),
  UNIQUE ("credit_note_id", "line_number")
);
CREATE INDEX "cnl_org_cn_idx" ON "credit_note_lines"("organization_id", "credit_note_id");

-- Bank accounts
CREATE TABLE "bank_accounts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "nominal_account_id" UUID NOT NULL,
  "currency" CHAR(3) NOT NULL DEFAULT 'GBP',
  "sort_code" VARCHAR(10),
  "account_number" VARCHAR(20),
  "iban" VARCHAR(34),
  "bank_name" VARCHAR(100),
  "status" "BankAccountStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id"),
  UNIQUE ("organization_id", "nominal_account_id")
);
CREATE UNIQUE INDEX "bank_accounts_org_id_key" ON "bank_accounts"("organization_id", "id");
CREATE INDEX "bank_accounts_org_status_idx" ON "bank_accounts"("organization_id", "status");

-- Bank statement imports
CREATE TABLE "bank_statement_imports" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "bank_account_id" UUID NOT NULL,
  "file_name" VARCHAR(255) NOT NULL,
  "file_format" "StatementFileFormat" NOT NULL,
  "file_sha256" CHAR(64) NOT NULL,
  "line_count" INT NOT NULL DEFAULT 0,
  "from_date" DATE,
  "to_date" DATE,
  "opening_balance" DECIMAL(19,4),
  "closing_balance" DECIMAL(19,4),
  "status" "StatementImportStatus" NOT NULL DEFAULT 'PENDING',
  "error_message" VARCHAR(500),
  "column_mapping" JSONB NOT NULL DEFAULT '{}',
  "imported_by" UUID NOT NULL,
  "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bank_statement_imports_pkey" PRIMARY KEY ("id"),
  UNIQUE ("organization_id", "file_sha256")
);
CREATE INDEX "bsi_org_bank_idx" ON "bank_statement_imports"("organization_id", "bank_account_id");

-- Bank statement lines
CREATE TABLE "bank_statement_lines" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "bank_account_id" UUID NOT NULL,
  "import_id" UUID NOT NULL,
  "transaction_date" DATE NOT NULL,
  "description" VARCHAR(500) NOT NULL,
  "payee" VARCHAR(200),
  "reference" VARCHAR(200),
  "amount" DECIMAL(19,4) NOT NULL,
  "balance" DECIMAL(19,4),
  "currency" CHAR(3) NOT NULL DEFAULT 'GBP',
  "external_id" VARCHAR(100),
  "raw_data" JSONB NOT NULL DEFAULT '{}',
  "status" "BankTransactionStatus" NOT NULL DEFAULT 'UNMATCHED',
  "matched_journal_line_id" UUID,
  "matched_payment_id" UUID,
  "suggested_account_id" UUID,
  "suggested_tax_code_id" UUID,
  "suggested_contact_id" UUID,
  "match_confidence" DECIMAL(5,4),
  "match_explanation" VARCHAR(500),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bank_statement_lines_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "bsl_dedup_key" ON "bank_statement_lines"(
  "organization_id", "bank_account_id", "transaction_date", "amount", "external_id"
) WHERE "external_id" IS NOT NULL;
CREATE INDEX "bsl_org_bank_date_idx" ON "bank_statement_lines"("organization_id", "bank_account_id", "transaction_date");
CREATE INDEX "bsl_org_status_idx" ON "bank_statement_lines"("organization_id", "status");
CREATE INDEX "bsl_import_idx" ON "bank_statement_lines"("import_id");

-- Bank rules
CREATE TABLE "bank_rules" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "bank_account_id" UUID,
  "is_enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "match_field" "BankRuleMatchField" NOT NULL,
  "match_type" "BankRuleMatchType" NOT NULL DEFAULT 'CONTAINS',
  "match_value" VARCHAR(200) NOT NULL,
  "amount_min" DECIMAL(19,4),
  "amount_max" DECIMAL(19,4),
  "transaction_direction" VARCHAR(10),
  "suggested_account_id" UUID,
  "suggested_tax_code_id" UUID,
  "suggested_contact_id" UUID,
  "auto_categorise" BOOLEAN NOT NULL DEFAULT FALSE,
  "priority" INT NOT NULL DEFAULT 100,
  "times_applied" INT NOT NULL DEFAULT 0,
  "created_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bank_rules_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "bank_rules_org_enabled_priority_idx" ON "bank_rules"("organization_id", "is_enabled", "priority");
