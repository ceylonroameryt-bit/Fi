-- CreateEnum
CREATE TYPE "TaxTreatment" AS ENUM ('STANDARD', 'REDUCED', 'ZERO', 'EXEMPT', 'OUTSIDE_SCOPE', 'DOMESTIC_REVERSE_CHARGE', 'REVERSE_CHARGE_SERVICES', 'POSTPONED_IMPORT_VAT');

-- CreateEnum
CREATE TYPE "TaxDirection" AS ENUM ('OUTPUT', 'INPUT');

-- AlterTable
ALTER TABLE "invoice_lines" ADD COLUMN     "tax_code_id" UUID;

-- AlterTable
ALTER TABLE "journal_lines" ADD COLUMN     "tax_amount" DECIMAL(19,4),
ADD COLUMN     "tax_code_id" UUID,
ADD COLUMN     "tax_direction" "TaxDirection",
ADD COLUMN     "tax_net_amount" DECIMAL(19,4);

-- CreateTable
CREATE TABLE "tax_codes" (
    "id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "country" CHAR(2) NOT NULL DEFAULT 'GB',
    "treatment" "TaxTreatment" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_code_rates" (
    "id" UUID NOT NULL,
    "tax_code_id" UUID NOT NULL,
    "rate" DECIMAL(7,4) NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_code_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tax_codes_code_key" ON "tax_codes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "tax_code_rates_tax_code_id_effective_from_key" ON "tax_code_rates"("tax_code_id", "effective_from");

-- CreateIndex
CREATE INDEX "journal_lines_organization_id_tax_code_id_idx" ON "journal_lines"("organization_id", "tax_code_id");

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_tax_code_id_fkey" FOREIGN KEY ("tax_code_id") REFERENCES "tax_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_code_rates" ADD CONSTRAINT "tax_code_rates_tax_code_id_fkey" FOREIGN KEY ("tax_code_id") REFERENCES "tax_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_tax_code_id_fkey" FOREIGN KEY ("tax_code_id") REFERENCES "tax_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Tax analysis on a journal line is all-or-nothing.
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_tax_fields_complete" CHECK (
  ("tax_code_id" IS NULL AND "tax_direction" IS NULL AND "tax_net_amount" IS NULL AND "tax_amount" IS NULL)
  OR ("tax_code_id" IS NOT NULL AND "tax_direction" IS NOT NULL AND "tax_net_amount" IS NOT NULL AND "tax_amount" IS NOT NULL)
);

ALTER TABLE "tax_code_rates" ADD CONSTRAINT "tax_code_rates_rate_range" CHECK ("rate" >= 0 AND "rate" <= 1);
ALTER TABLE "tax_code_rates" ADD CONSTRAINT "tax_code_rates_dates" CHECK ("effective_to" IS NULL OR "effective_to" >= "effective_from");

-- UK VAT codes (system reference data). Rates are dated so historic postings resolve correctly.
INSERT INTO "tax_codes" ("id", "code", "name", "description", "treatment", "updated_at") VALUES
  (gen_random_uuid(), 'UK_SR',        'Standard rate',                     'UK standard-rated supplies',                                  'STANDARD',                CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'UK_RR',        'Reduced rate',                      'UK reduced-rated supplies (e.g. domestic fuel)',              'REDUCED',                 CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'UK_ZR',        'Zero rate',                         'Zero-rated supplies (counted in boxes 6/7)',                  'ZERO',                    CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'UK_EX',        'Exempt',                            'Exempt supplies (counted in boxes 6/7)',                      'EXEMPT',                  CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'UK_OS',        'Outside the scope of VAT',          'Not a supply for VAT; excluded from the VAT return',          'OUTSIDE_SCOPE',           CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'UK_DRC_SR',    'Domestic reverse charge @ 20%',     'CIS construction services / specified goods, 20%',           'DOMESTIC_REVERSE_CHARGE', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'UK_DRC_RR',    'Domestic reverse charge @ 5%',      'CIS construction services, reduced rate',                     'DOMESTIC_REVERSE_CHARGE', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'UK_RC_SERV',   'Reverse charge – imported services','Services bought from overseas suppliers, 20%',                'REVERSE_CHARGE_SERVICES', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'UK_PIVA_SR',   'Postponed import VAT @ 20%',        'Goods imported under postponed VAT accounting, 20%',          'POSTPONED_IMPORT_VAT',    CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'UK_PIVA_RR',   'Postponed import VAT @ 5%',         'Goods imported under postponed VAT accounting, 5%',           'POSTPONED_IMPORT_VAT',    CURRENT_TIMESTAMP);

INSERT INTO "tax_code_rates" ("id", "tax_code_id", "rate", "effective_from", "effective_to")
SELECT gen_random_uuid(), tc."id", r."rate", r."from"::date, r."to"::date
FROM (VALUES
  ('UK_SR',      0.1750, '2010-01-01', '2011-01-03'),
  ('UK_SR',      0.2000, '2011-01-04', NULL),
  ('UK_RR',      0.0500, '1997-09-01', NULL),
  ('UK_ZR',      0.0000, '1973-04-01', NULL),
  ('UK_EX',      0.0000, '1973-04-01', NULL),
  ('UK_OS',      0.0000, '1973-04-01', NULL),
  ('UK_DRC_SR',  0.2000, '2021-03-01', NULL),
  ('UK_DRC_RR',  0.0500, '2021-03-01', NULL),
  ('UK_RC_SERV', 0.2000, '2011-01-04', NULL),
  ('UK_PIVA_SR', 0.2000, '2021-01-01', NULL),
  ('UK_PIVA_RR', 0.0500, '2021-01-01', NULL)
) AS r("code", "rate", "from", "to")
JOIN "tax_codes" tc ON tc."code" = r."code";

-- New permission, granted to existing Owner / Administrator / Accountant system roles.
INSERT INTO "permissions" ("id", "code", "description", "category")
VALUES (gen_random_uuid(), 'vat_return.view', 'View VAT return and drill-down', 'Reporting')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r CROSS JOIN "permissions" p
WHERE p."code" = 'vat_return.view' AND r."system_key" IN ('OWNER', 'ADMINISTRATOR', 'ACCOUNTANT')
ON CONFLICT DO NOTHING;
