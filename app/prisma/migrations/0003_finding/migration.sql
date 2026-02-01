-- CreateEnum
CREATE TYPE "FindingCategory" AS ENUM ('STRUCTURAL', 'FIRE_SAFETY', 'EGRESS', 'ACCESSIBILITY', 'ENERGY', 'GENERAL_BUILDING', 'SITE', 'PLUMBING', 'ELECTRICAL', 'MECHANICAL');

-- CreateEnum
CREATE TYPE "FindingStatus" AS ENUM ('COMPLIANT', 'WARNING', 'CRITICAL', 'NOT_ASSESSED');

-- CreateEnum
CREATE TYPE "Confidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateTable
CREATE TABLE "findings" (
    "id" UUID NOT NULL,
    "analysis_id" UUID NOT NULL,
    "code_reference" TEXT NOT NULL,
    "category" "FindingCategory" NOT NULL,
    "status" "FindingStatus" NOT NULL,
    "confidence" "Confidence" NOT NULL,
    "description" TEXT NOT NULL,
    "required_value" TEXT NOT NULL,
    "proposed_value" TEXT,
    "page_number" INTEGER,
    "location" TEXT,
    "analysis_notes" TEXT NOT NULL,
    "recommendation" TEXT,
    "raw_extraction" JSONB,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "findings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "findings_analysis_id_sort_order_idx" ON "findings"("analysis_id", "sort_order");

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
