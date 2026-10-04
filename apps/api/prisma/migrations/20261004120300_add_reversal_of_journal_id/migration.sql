-- AlterTable
ALTER TABLE "journal_entries" ADD COLUMN "reversal_of_journal_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_reversal_of_journal_id_key" ON "journal_entries"("reversal_of_journal_id");

-- CreateIndex
CREATE INDEX "journal_entries_reversal_of_journal_id_idx" ON "journal_entries"("reversal_of_journal_id");
