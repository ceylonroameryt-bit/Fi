-- CreateEnum
CREATE TYPE "DocumentTextSource" AS ENUM ('PDF_TEXT', 'OCR', 'PLAIN_TEXT');

-- AlterTable
ALTER TABLE "ai_documents" ADD COLUMN     "content_sha256" CHAR(64),
ADD COLUMN     "extracted_text" TEXT,
ADD COLUMN     "page_count" INTEGER,
ADD COLUMN     "text_source" "DocumentTextSource";

-- CreateTable
CREATE TABLE "ai_document_pages" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "page_number" INTEGER NOT NULL,
    "width" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "words" JSONB NOT NULL DEFAULT '[]',
    "text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_document_pages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_document_pages_organization_id_document_id_idx" ON "ai_document_pages"("organization_id", "document_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_document_pages_document_id_page_number_key" ON "ai_document_pages"("document_id", "page_number");

-- CreateIndex
CREATE UNIQUE INDEX "ai_documents_organization_id_content_sha256_key" ON "ai_documents"("organization_id", "content_sha256");

-- AddForeignKey
ALTER TABLE "ai_document_pages" ADD CONSTRAINT "ai_document_pages_organization_id_document_id_fkey" FOREIGN KEY ("organization_id", "document_id") REFERENCES "ai_documents"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

