-- Brings the database in line with schema.prisma for payments, credit notes and banking (code review 2026-10-22):
-- missing JournalSourceType values (every payment / credit-note posting failed), foreign keys (incl. the
-- composite tenant keys), unique indexes and index names that the earlier migration did not create.
-- AlterEnum


ALTER TYPE "JournalSourceType" ADD VALUE 'PAYMENT';
ALTER TYPE "JournalSourceType" ADD VALUE 'CREDIT_NOTE';

-- AlterTable
ALTER TABLE "bank_accounts" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "bank_rules" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "bank_statement_imports" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "bank_statement_lines" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "credit_note_lines" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "credit_notes" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "payment_allocations" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "payments" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "bank_rules_organization_id_bank_account_id_idx" ON "bank_rules"("organization_id", "bank_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "bank_statement_lines_organization_id_bank_account_id_transa_key" ON "bank_statement_lines"("organization_id", "bank_account_id", "transaction_date", "amount", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "credit_notes_organization_id_journal_entry_id_key" ON "credit_notes"("organization_id", "journal_entry_id");

-- CreateIndex
CREATE INDEX "payment_allocations_payment_id_idx" ON "payment_allocations"("payment_id");

-- CreateIndex
CREATE INDEX "payment_allocations_credit_note_id_idx" ON "payment_allocations"("credit_note_id");

-- CreateIndex
CREATE INDEX "payment_allocations_invoice_id_idx" ON "payment_allocations"("invoice_id");

-- CreateIndex
CREATE INDEX "payment_allocations_bill_id_idx" ON "payment_allocations"("bill_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_organization_id_journal_entry_id_key" ON "payments"("organization_id", "journal_entry_id");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_organization_id_contact_id_fkey" FOREIGN KEY ("organization_id", "contact_id") REFERENCES "contacts"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_organization_id_journal_entry_id_fkey" FOREIGN KEY ("organization_id", "journal_entry_id") REFERENCES "journal_entries"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_credit_note_id_fkey" FOREIGN KEY ("credit_note_id") REFERENCES "credit_notes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_organization_id_contact_id_fkey" FOREIGN KEY ("organization_id", "contact_id") REFERENCES "contacts"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_organization_id_journal_entry_id_fkey" FOREIGN KEY ("organization_id", "journal_entry_id") REFERENCES "journal_entries"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_note_lines" ADD CONSTRAINT "credit_note_lines_organization_id_credit_note_id_fkey" FOREIGN KEY ("organization_id", "credit_note_id") REFERENCES "credit_notes"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_note_lines" ADD CONSTRAINT "credit_note_lines_organization_id_account_id_fkey" FOREIGN KEY ("organization_id", "account_id") REFERENCES "accounts"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_note_lines" ADD CONSTRAINT "credit_note_lines_tax_code_id_fkey" FOREIGN KEY ("tax_code_id") REFERENCES "tax_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_organization_id_nominal_account_id_fkey" FOREIGN KEY ("organization_id", "nominal_account_id") REFERENCES "accounts"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statement_imports" ADD CONSTRAINT "bank_statement_imports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statement_imports" ADD CONSTRAINT "bank_statement_imports_organization_id_bank_account_id_fkey" FOREIGN KEY ("organization_id", "bank_account_id") REFERENCES "bank_accounts"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_organization_id_bank_account_id_fkey" FOREIGN KEY ("organization_id", "bank_account_id") REFERENCES "bank_accounts"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "bank_statement_imports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_rules" ADD CONSTRAINT "bank_rules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_rules" ADD CONSTRAINT "bank_rules_organization_id_bank_account_id_fkey" FOREIGN KEY ("organization_id", "bank_account_id") REFERENCES "bank_accounts"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "bank_accounts_org_id_key" RENAME TO "bank_accounts_organization_id_id_key";

-- RenameIndex
ALTER INDEX "bank_accounts_org_status_idx" RENAME TO "bank_accounts_organization_id_status_idx";

-- RenameIndex
ALTER INDEX "bank_rules_org_enabled_priority_idx" RENAME TO "bank_rules_organization_id_is_enabled_priority_idx";

-- RenameIndex
ALTER INDEX "bsi_org_bank_idx" RENAME TO "bank_statement_imports_organization_id_bank_account_id_idx";

-- RenameIndex
ALTER INDEX "bsl_import_idx" RENAME TO "bank_statement_lines_import_id_idx";

-- RenameIndex
ALTER INDEX "bsl_org_bank_date_idx" RENAME TO "bank_statement_lines_organization_id_bank_account_id_transa_idx";

-- RenameIndex
ALTER INDEX "bsl_org_status_idx" RENAME TO "bank_statement_lines_organization_id_status_idx";

-- RenameIndex
ALTER INDEX "cnl_org_cn_idx" RENAME TO "credit_note_lines_organization_id_credit_note_id_idx";

-- RenameIndex
ALTER INDEX "credit_notes_org_contact_idx" RENAME TO "credit_notes_organization_id_contact_id_idx";

-- RenameIndex
ALTER INDEX "credit_notes_org_id_key" RENAME TO "credit_notes_organization_id_id_key";

-- RenameIndex
ALTER INDEX "credit_notes_org_kind_idx" RENAME TO "credit_notes_organization_id_kind_idx";

-- RenameIndex
ALTER INDEX "credit_notes_org_number_key" RENAME TO "credit_notes_organization_id_credit_note_number_key";

-- RenameIndex
ALTER INDEX "credit_notes_org_status_idx" RENAME TO "credit_notes_organization_id_status_idx";

-- RenameIndex
ALTER INDEX "pa_org_idx" RENAME TO "payment_allocations_organization_id_idx";

-- RenameIndex
ALTER INDEX "payments_org_contact_idx" RENAME TO "payments_organization_id_contact_id_idx";

-- RenameIndex
ALTER INDEX "payments_org_date_idx" RENAME TO "payments_organization_id_payment_date_idx";

-- RenameIndex
ALTER INDEX "payments_org_kind_idx" RENAME TO "payments_organization_id_kind_idx";

-- RenameIndex
ALTER INDEX "payments_org_status_idx" RENAME TO "payments_organization_id_status_idx";

