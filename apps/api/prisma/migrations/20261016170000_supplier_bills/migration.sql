-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('DRAFT', 'APPROVED', 'POSTED', 'VOIDED');

-- CreateTable
CREATE TABLE "bills" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "bill_number" VARCHAR(30) NOT NULL,
    "supplier_invoice_number" VARCHAR(100) NOT NULL,
    "issue_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "subtotal" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "tax_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "amount_paid" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "status" "BillStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" VARCHAR(1000),
    "journal_entry_id" UUID,
    "source_document_id" UUID,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "approved_by" UUID,
    "approved_at" TIMESTAMP(3),
    "posted_by" UUID,
    "posted_at" TIMESTAMP(3),
    "voided_by" UUID,
    "voided_at" TIMESTAMP(3),
    "void_reason" VARCHAR(255),

    CONSTRAINT "bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_lines" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "bill_id" UUID NOT NULL,
    "line_number" SMALLINT NOT NULL,
    "account_id" UUID NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL,
    "unit_price" DECIMAL(19,4) NOT NULL,
    "net_amount" DECIMAL(19,4) NOT NULL,
    "tax_code_id" UUID,
    "tax_rate" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "line_total" DECIMAL(19,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bill_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bills_journal_entry_id_key" ON "bills"("journal_entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "bills_source_document_id_key" ON "bills"("source_document_id");

-- CreateIndex
CREATE INDEX "bills_organization_id_status_idx" ON "bills"("organization_id", "status");

-- CreateIndex
CREATE INDEX "bills_organization_id_contact_id_supplier_invoice_number_idx" ON "bills"("organization_id", "contact_id", "supplier_invoice_number");

-- CreateIndex
CREATE INDEX "bills_organization_id_issue_date_idx" ON "bills"("organization_id", "issue_date");

-- CreateIndex
CREATE UNIQUE INDEX "bills_organization_id_bill_number_key" ON "bills"("organization_id", "bill_number");

-- CreateIndex
CREATE UNIQUE INDEX "bills_organization_id_id_key" ON "bills"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "bills_organization_id_journal_entry_id_key" ON "bills"("organization_id", "journal_entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "bills_organization_id_source_document_id_key" ON "bills"("organization_id", "source_document_id");

-- CreateIndex
CREATE INDEX "bill_lines_organization_id_account_id_idx" ON "bill_lines"("organization_id", "account_id");

-- CreateIndex
CREATE UNIQUE INDEX "bill_lines_bill_id_line_number_key" ON "bill_lines"("bill_id", "line_number");

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_organization_id_contact_id_fkey" FOREIGN KEY ("organization_id", "contact_id") REFERENCES "contacts"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_organization_id_journal_entry_id_fkey" FOREIGN KEY ("organization_id", "journal_entry_id") REFERENCES "journal_entries"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_organization_id_source_document_id_fkey" FOREIGN KEY ("organization_id", "source_document_id") REFERENCES "ai_documents"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_lines" ADD CONSTRAINT "bill_lines_organization_id_bill_id_fkey" FOREIGN KEY ("organization_id", "bill_id") REFERENCES "bills"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_lines" ADD CONSTRAINT "bill_lines_organization_id_account_id_fkey" FOREIGN KEY ("organization_id", "account_id") REFERENCES "accounts"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_lines" ADD CONSTRAINT "bill_lines_tax_code_id_fkey" FOREIGN KEY ("tax_code_id") REFERENCES "tax_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Bill permissions, granted to existing system roles.
INSERT INTO "permissions" ("id", "code", "description", "category") VALUES
  (gen_random_uuid(), 'bill.view', 'View supplier bills', 'Purchases'),
  (gen_random_uuid(), 'bill.create', 'Create draft supplier bills', 'Purchases'),
  (gen_random_uuid(), 'bill.edit_draft', 'Edit draft supplier bills', 'Purchases'),
  (gen_random_uuid(), 'bill.delete_draft', 'Delete draft supplier bills', 'Purchases'),
  (gen_random_uuid(), 'bill.approve', 'Approve and post supplier bills to the General Ledger', 'Purchases'),
  (gen_random_uuid(), 'bill.void', 'Void posted supplier bills by reversing their journals', 'Purchases')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "roles" r CROSS JOIN "permissions" p
WHERE (r."system_key" IN ('OWNER', 'ADMINISTRATOR', 'ACCOUNTANT') AND p."code" LIKE 'bill.%')
   OR (r."system_key" = 'BOOKKEEPER' AND p."code" IN ('bill.view', 'bill.create', 'bill.edit_draft'))
   OR (r."system_key" = 'VIEWER' AND p."code" = 'bill.view')
ON CONFLICT DO NOTHING;
