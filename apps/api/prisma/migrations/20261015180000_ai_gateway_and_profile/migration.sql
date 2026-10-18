-- CreateEnum
CREATE TYPE "VatScheme" AS ENUM ('STANDARD', 'CASH_ACCOUNTING', 'FLAT_RATE', 'ANNUAL_ACCOUNTING', 'NOT_REGISTERED');

-- CreateEnum
CREATE TYPE "AiCallStatus" AS ENUM ('SUCCESS', 'REFUSED', 'INVALID_OUTPUT', 'ERROR', 'BLOCKED');

-- AlterTable
ALTER TABLE "organization_business_contexts" ADD COLUMN     "coding_habits" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "profile_refreshed_at" TIMESTAMP(3),
ADD COLUMN     "usual_customers" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "usual_suppliers" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "vat_scheme" "VatScheme";

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "ai_enabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ai_usage_logs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID,
    "feature" VARCHAR(50) NOT NULL,
    "provider" VARCHAR(30) NOT NULL,
    "model" VARCHAR(64),
    "prompt_key" VARCHAR(64) NOT NULL,
    "prompt_version" INTEGER NOT NULL,
    "prompt_hash" CHAR(64) NOT NULL,
    "status" "AiCallStatus" NOT NULL,
    "error_code" VARCHAR(64),
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "cache_read_tokens" INTEGER NOT NULL DEFAULT 0,
    "cache_write_tokens" INTEGER NOT NULL DEFAULT 0,
    "cost_usd" DECIMAL(14,6),
    "latency_ms" INTEGER NOT NULL DEFAULT 0,
    "document_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_usage_logs_organization_id_created_at_idx" ON "ai_usage_logs"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_usage_logs_organization_id_feature_idx" ON "ai_usage_logs"("organization_id", "feature");

-- AddForeignKey
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AI permissions, granted to existing system roles.
INSERT INTO "permissions" ("id", "code", "description", "category") VALUES
  (gen_random_uuid(), 'ai.manage', 'Turn AI features on/off and edit the business profile', 'AI'),
  (gen_random_uuid(), 'ai.usage.view', 'View AI usage and cost', 'AI')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "roles" r CROSS JOIN "permissions" p
WHERE (p."code" = 'ai.manage' AND r."system_key" IN ('OWNER', 'ADMINISTRATOR'))
   OR (p."code" = 'ai.usage.view' AND r."system_key" IN ('OWNER', 'ADMINISTRATOR', 'ACCOUNTANT'))
ON CONFLICT DO NOTHING;
