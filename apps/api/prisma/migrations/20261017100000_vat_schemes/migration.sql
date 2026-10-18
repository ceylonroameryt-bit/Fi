-- Stage 0 (sales & purchases): dated VAT scheme per organisation.
CREATE TABLE "organization_vat_schemes" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "scheme" "VatScheme" NOT NULL,
    "start_date" DATE NOT NULL,
    "flat_rate_percent" DECIMAL(5,2),
    "limited_cost_trader" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "organization_vat_schemes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "organization_vat_schemes_flat_rate_check" CHECK (
      ("scheme" = 'FLAT_RATE' AND "flat_rate_percent" > 0 AND "flat_rate_percent" <= 100)
      OR ("scheme" <> 'FLAT_RATE' AND "flat_rate_percent" IS NULL AND "limited_cost_trader" = false)
    )
);
CREATE UNIQUE INDEX "organization_vat_schemes_organization_id_start_date_key" ON "organization_vat_schemes"("organization_id", "start_date");
ALTER TABLE "organization_vat_schemes" ADD CONSTRAINT "organization_vat_schemes_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The AI business profile's person-entered scheme becomes the organisation's setting (from the
-- earliest financial year, or 2000-01-01). Flat Rate without a percentage cannot be carried over.
INSERT INTO "organization_vat_schemes" ("id", "organization_id", "scheme", "start_date")
SELECT gen_random_uuid(), c."organization_id", c."vat_scheme",
       COALESCE((SELECT MIN(fy."start_date") FROM "financial_years" fy WHERE fy."organization_id" = c."organization_id"), DATE '2000-01-01')
FROM "organization_business_contexts" c
WHERE c."vat_scheme" IS NOT NULL AND c."vat_scheme" <> 'FLAT_RATE';

ALTER TABLE "organization_business_contexts" DROP COLUMN "vat_scheme";
