-- CreateTable
CREATE TABLE "ai_review_decisions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "suggestion_id" UUID NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "outcome" VARCHAR(20) NOT NULL,
    "ai_values" JSONB NOT NULL,
    "final_values" JSONB NOT NULL,
    "changed_fields" JSONB NOT NULL DEFAULT '[]',
    "overrides" JSONB NOT NULL DEFAULT '[]',
    "reason" VARCHAR(500),
    "resulting_bill_id" UUID,
    "resulting_invoice_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_review_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_review_decisions_organization_id_document_id_idx" ON "ai_review_decisions"("organization_id", "document_id");

-- CreateIndex
CREATE INDEX "ai_review_decisions_organization_id_created_at_idx" ON "ai_review_decisions"("organization_id", "created_at");

-- AddForeignKey
ALTER TABLE "ai_review_decisions" ADD CONSTRAINT "ai_review_decisions_organization_id_document_id_fkey" FOREIGN KEY ("organization_id", "document_id") REFERENCES "ai_documents"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Append-only: decisions are evidence and are never edited or deleted.
CREATE OR REPLACE FUNCTION ai_review_decisions_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ai_review_decisions is append-only';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER ai_review_decisions_no_update BEFORE UPDATE OR DELETE ON "ai_review_decisions"
  FOR EACH ROW EXECUTE FUNCTION ai_review_decisions_immutable();

INSERT INTO "permissions" ("id", "code", "description", "category")
VALUES (gen_random_uuid(), 'ai_draft.approve', 'Approve or reject AI-prepared drafts', 'AI')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "roles" r CROSS JOIN "permissions" p
WHERE p."code" = 'ai_draft.approve' AND r."system_key" IN ('OWNER', 'ADMINISTRATOR', 'ACCOUNTANT')
ON CONFLICT DO NOTHING;
