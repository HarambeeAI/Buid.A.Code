-- US-002: Add Analysis model
-- CreateEnum
CREATE TYPE "Region" AS ENUM ('AU', 'UK', 'US');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('PDF', 'PNG', 'JPG', 'TIFF', 'DXF', 'IFC');

-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('PENDING', 'CLASSIFYING', 'ANALYSING', 'VALIDATING', 'GENERATING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "OverallStatus" AS ENUM ('PASS', 'CONDITIONAL', 'FAIL');

-- CreateTable
CREATE TABLE "analyses" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "report_ref" TEXT NOT NULL,
    "document_name" TEXT NOT NULL,
    "document_url" TEXT NOT NULL,
    "document_size" INTEGER NOT NULL,
    "document_type" "DocumentType" NOT NULL,
    "page_count" INTEGER NOT NULL,
    "description" TEXT,
    "page_numbers" TEXT,
    "region" "Region" NOT NULL,
    "selected_codes" JSONB NOT NULL,
    "status" "AnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "current_stage" TEXT,
    "compliance_score" DOUBLE PRECISION,
    "overall_status" "OverallStatus",
    "critical_count" INTEGER NOT NULL DEFAULT 0,
    "warning_count" INTEGER NOT NULL DEFAULT 0,
    "compliant_count" INTEGER NOT NULL DEFAULT 0,
    "not_assessed_count" INTEGER NOT NULL DEFAULT 0,
    "total_checks" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analyses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "analyses_report_ref_key" ON "analyses"("report_ref");

-- AddForeignKey
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
