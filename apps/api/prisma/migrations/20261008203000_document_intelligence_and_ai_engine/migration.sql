-- CreateEnum
CREATE TYPE "AiDocumentType" AS ENUM ('PURCHASE_INVOICE', 'SALES_INVOICE', 'PURCHASE_CREDIT_NOTE', 'SALES_CREDIT_NOTE', 'RECEIPT', 'EXPENSE_RECEIPT', 'BANK_STATEMENT', 'DELIVERY_NOTE', 'STATEMENT', 'OTHER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "AiDocumentStatus" AS ENUM ('PENDING', 'PROCESSING', 'REQUIRES_REVIEW', 'DRAFTED', 'APPROVED', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "AiDirection" AS ENUM ('PURCHASE', 'SALE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "AiProductType" AS ENUM ('INVENTORY', 'EXPENSE', 'FIXED_ASSET', 'SERVICE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "AiConfidenceLevel" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "AiSuggestionStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'EDITED');

-- CreateTable
CREATE TABLE "organization_business_contexts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "industry" VARCHAR(50) NOT NULL DEFAULT 'GENERAL',
    "inventory_enabled" BOOLEAN NOT NULL DEFAULT true,
    "inventory_categories" JSONB NOT NULL DEFAULT '[]',
    "sales_channels" JSONB NOT NULL DEFAULT '[]',
    "accounting_method" VARCHAR(50) NOT NULL DEFAULT 'INVENTORY_BASED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_business_contexts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_documents" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "file_key" VARCHAR(255) NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "document_type" "AiDocumentType" NOT NULL DEFAULT 'UNKNOWN',
    "direction" "AiDirection" NOT NULL DEFAULT 'UNKNOWN',
    "status" "AiDocumentStatus" NOT NULL DEFAULT 'PENDING',
    "confidence_score" DECIMAL(5,4),
    "confidence_level" "AiConfidenceLevel" NOT NULL DEFAULT 'MEDIUM',
    "error_message" VARCHAR(500),
    "created_by" UUID NOT NULL,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_extractions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "invoice_number" VARCHAR(50),
    "invoice_date" DATE,
    "due_date" DATE,
    "currency" CHAR(3),
    "issuer_name" VARCHAR(200),
    "issuer_tax_id" VARCHAR(50),
    "issuer_address" VARCHAR(500),
    "recipient_name" VARCHAR(200),
    "recipient_tax_id" VARCHAR(50),
    "recipient_address" VARCHAR(500),
    "subtotal" DECIMAL(19,4),
    "tax_amount" DECIMAL(19,4),
    "total_amount" DECIMAL(19,4),
    "raw_structured_data" JSONB NOT NULL,
    "model_version" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_extractions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_classifications" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "direction" "AiDirection" NOT NULL,
    "entity_type" VARCHAR(30) NOT NULL,
    "entity_id" UUID,
    "entity_match_reason" VARCHAR(255),
    "classification" VARCHAR(100) NOT NULL,
    "confidence_score" DECIMAL(5,4) NOT NULL,
    "reasoning" VARCHAR(1000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_classifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_line_classifications" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "line_number" SMALLINT NOT NULL,
    "raw_description" VARCHAR(255) NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL DEFAULT 1,
    "unit" VARCHAR(30),
    "unit_price" DECIMAL(19,4) NOT NULL,
    "net_amount" DECIMAL(19,4) NOT NULL,
    "tax_amount" DECIMAL(19,4) NOT NULL,
    "total_amount" DECIMAL(19,4) NOT NULL,
    "product_type" "AiProductType" NOT NULL,
    "product_classification" VARCHAR(100) NOT NULL,
    "tax_classification" VARCHAR(50) NOT NULL,
    "accounting_category" VARCHAR(100) NOT NULL,
    "resolved_account_id" UUID,
    "confidence_score" DECIMAL(5,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_line_classifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_suggestions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "suggestion_type" VARCHAR(50) NOT NULL,
    "payload" JSONB NOT NULL,
    "confidence_score" DECIMAL(5,4) NOT NULL,
    "confidence_level" "AiConfidenceLevel" NOT NULL,
    "status" "AiSuggestionStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "review_note" VARCHAR(500),
    "resulting_invoice_id" UUID,
    "resulting_journal_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_feedbacks" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "suggestion_id" UUID,
    "supplier_or_customer_id" UUID,
    "product_pattern" VARCHAR(255) NOT NULL,
    "original_classification" VARCHAR(100) NOT NULL,
    "corrected_classification" VARCHAR(100) NOT NULL,
    "corrected_account_id" UUID,
    "corrected_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_audit_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "actor_id" UUID,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_business_contexts_organization_id_key" ON "organization_business_contexts"("organization_id");

-- CreateIndex
CREATE INDEX "ai_documents_organization_id_status_idx" ON "ai_documents"("organization_id", "status");

-- CreateIndex
CREATE INDEX "ai_documents_organization_id_document_type_idx" ON "ai_documents"("organization_id", "document_type");

-- CreateIndex
CREATE UNIQUE INDEX "ai_documents_organization_id_id_key" ON "ai_documents"("organization_id", "id");

-- CreateIndex
CREATE INDEX "ai_extractions_document_id_idx" ON "ai_extractions"("document_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_extractions_organization_id_id_key" ON "ai_extractions"("organization_id", "id");

-- CreateIndex
CREATE INDEX "ai_classifications_document_id_idx" ON "ai_classifications"("document_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_classifications_organization_id_id_key" ON "ai_classifications"("organization_id", "id");

-- CreateIndex
CREATE INDEX "ai_line_classifications_document_id_line_number_idx" ON "ai_line_classifications"("document_id", "line_number");

-- CreateIndex
CREATE UNIQUE INDEX "ai_line_classifications_organization_id_id_key" ON "ai_line_classifications"("organization_id", "id");

-- CreateIndex
CREATE INDEX "ai_suggestions_organization_id_status_idx" ON "ai_suggestions"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ai_suggestions_organization_id_id_key" ON "ai_suggestions"("organization_id", "id");

-- CreateIndex
CREATE INDEX "ai_feedbacks_organization_id_product_pattern_idx" ON "ai_feedbacks"("organization_id", "product_pattern");

-- CreateIndex
CREATE INDEX "ai_feedbacks_organization_id_supplier_or_customer_id_idx" ON "ai_feedbacks"("organization_id", "supplier_or_customer_id");

-- CreateIndex
CREATE INDEX "ai_audit_events_organization_id_document_id_idx" ON "ai_audit_events"("organization_id", "document_id");

-- CreateIndex
CREATE INDEX "ai_audit_events_organization_id_created_at_idx" ON "ai_audit_events"("organization_id", "created_at");

-- AddForeignKey
ALTER TABLE "organization_business_contexts" ADD CONSTRAINT "organization_business_contexts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_documents" ADD CONSTRAINT "ai_documents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_documents" ADD CONSTRAINT "ai_documents_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_extractions" ADD CONSTRAINT "ai_extractions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_extractions" ADD CONSTRAINT "ai_extractions_organization_id_document_id_fkey" FOREIGN KEY ("organization_id", "document_id") REFERENCES "ai_documents"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_classifications" ADD CONSTRAINT "ai_classifications_organization_id_document_id_fkey" FOREIGN KEY ("organization_id", "document_id") REFERENCES "ai_documents"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_classifications" ADD CONSTRAINT "ai_classifications_organization_id_entity_id_fkey" FOREIGN KEY ("organization_id", "entity_id") REFERENCES "contacts"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_line_classifications" ADD CONSTRAINT "ai_line_classifications_organization_id_document_id_fkey" FOREIGN KEY ("organization_id", "document_id") REFERENCES "ai_documents"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_line_classifications" ADD CONSTRAINT "ai_line_classifications_organization_id_resolved_account_i_fkey" FOREIGN KEY ("organization_id", "resolved_account_id") REFERENCES "accounts"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_organization_id_document_id_fkey" FOREIGN KEY ("organization_id", "document_id") REFERENCES "ai_documents"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_feedbacks" ADD CONSTRAINT "ai_feedbacks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_feedbacks" ADD CONSTRAINT "ai_feedbacks_corrected_by_fkey" FOREIGN KEY ("corrected_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_audit_events" ADD CONSTRAINT "ai_audit_events_organization_id_document_id_fkey" FOREIGN KEY ("organization_id", "document_id") REFERENCES "ai_documents"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

