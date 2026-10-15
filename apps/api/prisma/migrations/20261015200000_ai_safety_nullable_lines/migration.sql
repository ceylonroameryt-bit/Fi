-- AlterTable
ALTER TABLE "ai_line_classifications" ALTER COLUMN "quantity" DROP NOT NULL,
ALTER COLUMN "quantity" DROP DEFAULT,
ALTER COLUMN "unit_price" DROP NOT NULL,
ALTER COLUMN "net_amount" DROP NOT NULL,
ALTER COLUMN "tax_amount" DROP NOT NULL,
ALTER COLUMN "total_amount" DROP NOT NULL,
ALTER COLUMN "tax_classification" DROP NOT NULL;

