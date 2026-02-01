-- Migration: 0005_code_request_and_share_token
-- Description: Add CodeRequest and ShareToken models for US-005

-- Create CodeRequestStatus enum
CREATE TYPE "CodeRequestStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'IN_PROGRESS', 'PUBLISHED', 'DECLINED');

-- Create CodeRequest table
CREATE TABLE "code_requests" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "code_name" TEXT NOT NULL,
    "region" "Region" NOT NULL,
    "description" TEXT,
    "reference_url" TEXT,
    "status" "CodeRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "admin_notes" TEXT,
    "resolved_code_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "code_requests_pkey" PRIMARY KEY ("id")
);

-- Create ShareToken table
CREATE TABLE "share_tokens" (
    "id" UUID NOT NULL,
    "analysis_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "share_tokens_pkey" PRIMARY KEY ("id")
);

-- Create unique index on token
CREATE UNIQUE INDEX "share_tokens_token_key" ON "share_tokens"("token");

-- Add foreign key constraint: CodeRequest -> User (cascade delete)
ALTER TABLE "code_requests" ADD CONSTRAINT "code_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add foreign key constraint: CodeRequest -> BuildingCode (set null on delete)
ALTER TABLE "code_requests" ADD CONSTRAINT "code_requests_resolved_code_id_fkey" FOREIGN KEY ("resolved_code_id") REFERENCES "building_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add foreign key constraint: ShareToken -> Analysis (cascade delete)
ALTER TABLE "share_tokens" ADD CONSTRAINT "share_tokens_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
