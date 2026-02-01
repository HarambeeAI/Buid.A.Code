import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { GoogleGenerativeAI } from "@google/generative-ai";

const UuidSchema = z.string().uuid();

/**
 * Generate embeddings for text using Gemini text-embedding-004
 * Returns a 768-dimensional vector
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "text-embedding-004" });

  const result = await model.embedContent(text);
  return result.embedding.values;
}

/**
 * POST /api/admin/codes/:id/publish
 * Publish a building code and its verified requirements.
 * - Sets all VERIFIED requirements to PUBLISHED
 * - Generates embeddings for each requirement
 * - Sets BuildingCode status to ACTIVE
 * - Records published_at and published_by
 * Admin only (protected by middleware).
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const validation = UuidSchema.safeParse(id);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Bad Request", message: "Invalid code ID" },
        { status: 400 }
      );
    }

    // Get authenticated user
    const { session, response } = await requireAuth(request);
    if (response) return response;

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { logto_user_id: session!.userId },
      select: { id: true, role: true },
    });

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden", message: "Admin access required" },
        { status: 403 }
      );
    }

    // Find the building code
    const code = await prisma.buildingCode.findUnique({
      where: { id },
      include: {
        requirements: {
          where: { status: "VERIFIED" },
        },
      },
    });

    if (!code) {
      return NextResponse.json(
        { error: "Not Found", message: "Building code not found" },
        { status: 404 }
      );
    }

    // Check if there are any verified requirements
    if (code.requirements.length === 0) {
      return NextResponse.json(
        {
          error: "Bad Request",
          message: "No verified requirements to publish. Verify at least one requirement first.",
          code: "NO_VERIFIED_REQUIREMENTS",
        },
        { status: 400 }
      );
    }

    // Check if already ACTIVE
    if (code.status === "ACTIVE") {
      return NextResponse.json(
        {
          error: "Bad Request",
          message: "Building code is already published and active.",
          code: "ALREADY_PUBLISHED",
        },
        { status: 400 }
      );
    }

    // Generate embeddings for each requirement and update status
    const publishedAt = new Date();

    // Use a transaction to ensure atomicity
    await prisma.$transaction(async (tx) => {
      // Update each verified requirement to PUBLISHED with embedding
      for (const req of code.requirements) {
        // Generate embedding from full_text + title + code_ref
        const textForEmbedding = `${req.code_ref} ${req.title} ${req.full_text}`;
        const embedding = await generateEmbedding(textForEmbedding);

        // Update requirement with raw SQL for vector field
        await tx.$executeRaw`
          UPDATE code_requirements
          SET status = 'PUBLISHED',
              embedding = ${embedding}::vector,
              updated_at = ${publishedAt}
          WHERE id = ${req.id}::uuid
        `;
      }

      // Update building code status to ACTIVE
      await tx.buildingCode.update({
        where: { id },
        data: {
          status: "ACTIVE",
          published_at: publishedAt,
          published_by: user.id,
        },
      });
    });

    // Fetch updated code
    const updatedCode = await prisma.buildingCode.findUnique({
      where: { id },
      select: {
        id: true,
        code_id: true,
        name: true,
        region: true,
        version: true,
        status: true,
        published_at: true,
        _count: {
          select: {
            requirements: {
              where: { status: "PUBLISHED" },
            },
          },
        },
      },
    });

    return NextResponse.json({
      message: `Successfully published ${code.requirements.length} requirements`,
      code: updatedCode,
      published_count: code.requirements.length,
    });
  } catch (error) {
    console.error("Error publishing building code:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to publish building code" },
      { status: 500 }
    );
  }
}
