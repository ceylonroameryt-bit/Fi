-- AlterTable
ALTER TABLE "ai_suggestions" ADD COLUMN     "resulting_bill_id" UUID;

-- AlterTable
ALTER TABLE "bill_lines" ALTER COLUMN "quantity" DROP NOT NULL,
ALTER COLUMN "unit_price" DROP NOT NULL;

