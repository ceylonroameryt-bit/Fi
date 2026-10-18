-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'DEAD');

-- AlterEnum
BEGIN;
CREATE TYPE "AiDocumentStatus_new" AS ENUM ('UPLOADED', 'TEXT_EXTRACTED', 'AI_EXTRACTED', 'VALIDATED', 'AWAITING_REVIEW', 'DRAFT_CREATED', 'REJECTED', 'FAILED');
ALTER TABLE "public"."ai_documents" ALTER COLUMN "status" DROP DEFAULT;
-- Map prototype states onto the Stage 6 pipeline states.
ALTER TABLE "ai_documents" ALTER COLUMN "status" TYPE "AiDocumentStatus_new" USING (
  CASE "status"::text
    WHEN 'PENDING' THEN 'UPLOADED'
    WHEN 'PROCESSING' THEN 'UPLOADED'
    WHEN 'REQUIRES_REVIEW' THEN 'AWAITING_REVIEW'
    WHEN 'DRAFTED' THEN 'DRAFT_CREATED'
    WHEN 'APPROVED' THEN 'DRAFT_CREATED'
    ELSE "status"::text
  END
)::"AiDocumentStatus_new";
ALTER TYPE "AiDocumentStatus" RENAME TO "AiDocumentStatus_old";
ALTER TYPE "AiDocumentStatus_new" RENAME TO "AiDocumentStatus";
DROP TYPE "public"."AiDocumentStatus_old";
ALTER TABLE "ai_documents" ALTER COLUMN "status" SET DEFAULT 'UPLOADED';
COMMIT;

-- AlterTable
ALTER TABLE "ai_documents" ADD COLUMN     "failure_code" VARCHAR(64),
ALTER COLUMN "status" SET DEFAULT 'UPLOADED';

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "ai_monthly_cost_limit_usd" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "jobs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "type" VARCHAR(64) NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "idempotency_key" VARCHAR(200) NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "run_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "locked_at" TIMESTAMP(3),
    "locked_by" VARCHAR(100),
    "finished_at" TIMESTAMP(3),
    "last_error" VARCHAR(1000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "jobs_idempotency_key_key" ON "jobs"("idempotency_key");

-- CreateIndex
CREATE INDEX "jobs_status_run_at_idx" ON "jobs"("status", "run_at");

-- CreateIndex
CREATE INDEX "jobs_organization_id_status_idx" ON "jobs"("organization_id", "status");

-- CreateIndex
CREATE INDEX "jobs_organization_id_started_at_idx" ON "jobs"("organization_id", "started_at");

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

