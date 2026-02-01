import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const UuidSchema = z.string().uuid();

/**
 * POST /api/admin/codes/:id/verify-all
 * Mark all DRAFT requirements for a building code as VERIFIED.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const idValidation = UuidSchema.safeParse(id);
    if (!idValidation.success) {
      return NextResponse.json(
        { error: "Bad Request", message: "Invalid code ID" },
        { status: 400 }
      );
    }

    // Check building code exists
    const code = await prisma.buildingCode.findUnique({
      where: { id },
      select: { id: true, name: true },
    });

    if (!code) {
      return NextResponse.json(
        { error: "Not Found", message: "Building code not found" },
        { status: 404 }
      );
    }

    // Count draft requirements
    const draftCount = await prisma.codeRequirement.count({
      where: {
        building_code_id: id,
        status: "DRAFT",
      },
    });

    if (draftCount === 0) {
      return NextResponse.json(
        { error: "Bad Request", message: "No draft requirements to verify" },
        { status: 400 }
      );
    }

    // Update all draft requirements to verified
    const result = await prisma.codeRequirement.updateMany({
      where: {
        building_code_id: id,
        status: "DRAFT",
      },
      data: { status: "VERIFIED" },
    });

    return NextResponse.json({
      success: true,
      count: result.count,
      message: `${result.count} requirements verified`,
    });
  } catch (error) {
    console.error("Error verifying all requirements:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to verify requirements" },
      { status: 500 }
    );
  }
}
