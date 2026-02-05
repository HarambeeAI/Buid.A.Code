-- US-004: BuildingCode and CodeRequirement tables
-- CreateEnum: BuildingCodeStatus
CREATE TYPE "BuildingCodeStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DEPRECATED');

-- CreateEnum: CodeRequirementStatus
CREATE TYPE "CodeRequirementStatus" AS ENUM ('DRAFT', 'VERIFIED', 'PUBLISHED', 'DEPRECATED');

-- CreateEnum: CheckType
CREATE TYPE "CheckType" AS ENUM ('MEASUREMENT_THRESHOLD', 'PRESENCE_CHECK', 'RATIO_CHECK', 'BOOLEAN_CHECK');

-- CreateTable: building_codes
CREATE TABLE "building_codes" (
    "id" UUID NOT NULL,
    "region" "Region" NOT NULL,
    "code_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" TEXT NOT NULL,
    "status" "BuildingCodeStatus" NOT NULL DEFAULT 'DRAFT',
    "source_document_url" TEXT,
    "published_at" TIMESTAMP(3),
    "published_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "building_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable: code_requirements
CREATE TABLE "code_requirements" (
    "id" UUID NOT NULL,
    "building_code_id" UUID NOT NULL,
    "code_ref" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "FindingCategory" NOT NULL,
    "full_text" TEXT NOT NULL,
    "check_type" "CheckType" NOT NULL,
    "thresholds" JSONB NOT NULL,
    "applies_to_drawing_types" JSONB NOT NULL,
    "applies_to_building_types" JSONB NOT NULL,
    "applies_to_spaces" JSONB NOT NULL,
    "exceptions" JSONB NOT NULL,
    "extraction_guidance" TEXT NOT NULL,
    "evaluation_guidance" TEXT NOT NULL,
    "source_page" INTEGER,
    "status" "CodeRequirementStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "code_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Unique constraint on code_id
CREATE UNIQUE INDEX "building_codes_code_id_key" ON "building_codes"("code_id");

-- AddForeignKey: building_codes.published_by -> users.id
ALTER TABLE "building_codes" ADD CONSTRAINT "building_codes_published_by_fkey" FOREIGN KEY ("published_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: code_requirements.building_code_id -> building_codes.id (Cascade delete)
ALTER TABLE "code_requirements" ADD CONSTRAINT "code_requirements_building_code_id_fkey" FOREIGN KEY ("building_code_id") REFERENCES "building_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
