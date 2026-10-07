-- DropForeignKey
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_org_journal_entry_fk";

-- DropForeignKey
ALTER TABLE "journal_entries" DROP CONSTRAINT "journal_entries_org_reversed_by_fk";

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "company_number" VARCHAR(50),
ADD COLUMN     "shipping_address_line_1" VARCHAR(200),
ADD COLUMN     "shipping_address_line_2" VARCHAR(200),
ADD COLUMN     "shipping_city" VARCHAR(100),
ADD COLUMN     "shipping_country" CHAR(2),
ADD COLUMN     "shipping_postcode" VARCHAR(20),
ADD COLUMN     "shipping_state" VARCHAR(100),
ADD COLUMN     "vat_number" VARCHAR(50);

-- CreateTable
CREATE TABLE "contact_people" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "job_title" VARCHAR(100),
    "email" VARCHAR(254),
    "phone" VARCHAR(50),
    "mobile" VARCHAR(50),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_billing_contact" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_people_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contact_people_organization_id_contact_id_idx" ON "contact_people"("organization_id", "contact_id");

-- CreateIndex
CREATE INDEX "contact_people_organization_id_email_idx" ON "contact_people"("organization_id", "email");

-- CreateIndex
CREATE INDEX "contacts_organization_id_company_number_idx" ON "contacts"("organization_id", "company_number");

-- CreateIndex
CREATE INDEX "contacts_organization_id_vat_number_idx" ON "contacts"("organization_id", "vat_number");

-- CreateIndex
CREATE INDEX "journal_lines_organization_id_contact_id_idx" ON "journal_lines"("organization_id", "contact_id");

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_organization_id_reversed_by_journal_id_fkey" FOREIGN KEY ("organization_id", "reversed_by_journal_id") REFERENCES "journal_entries"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "journal_lines" jl
    JOIN "contacts" c ON jl."contact_id" = c."id"
    WHERE jl."organization_id" != c."organization_id"
  ) THEN
    RAISE EXCEPTION 'Cross-tenant journal_lines.contact_id detected prior to applying foreign key constraint';
  END IF;
END $$;

ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_organization_id_contact_id_fkey" FOREIGN KEY ("organization_id", "contact_id") REFERENCES "contacts"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_people" ADD CONSTRAINT "contact_people_organization_id_contact_id_fkey" FOREIGN KEY ("organization_id", "contact_id") REFERENCES "contacts"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organization_id_journal_entry_id_fkey" FOREIGN KEY ("organization_id", "journal_entry_id") REFERENCES "journal_entries"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

