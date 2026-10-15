-- AlterTable
ALTER TABLE "ai_line_classifications" ADD COLUMN     "account_source" VARCHAR(20),
ADD COLUMN     "coding_reason" VARCHAR(1000),
ADD COLUMN     "suggested_tax_code_id" UUID,
ADD COLUMN     "tax_source" VARCHAR(20);

-- AddForeignKey
ALTER TABLE "ai_line_classifications" ADD CONSTRAINT "ai_line_classifications_suggested_tax_code_id_fkey" FOREIGN KEY ("suggested_tax_code_id") REFERENCES "tax_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

