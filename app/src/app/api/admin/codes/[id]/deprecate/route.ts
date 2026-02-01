import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

const UuidSchema = z.string().uuid();

/**
 * PATCH /api/admin/codes/:id/deprecate
 * Deprecate a building code.
 * - Sets BuildingCode status to DEPRECATED
 * - Sets all PUBLISHED requirements to DEPRECATED
 * Admin only (protected by middleware).
 */
export async function PATCH(
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
    });

    if (!code) {
      return NextResponse.json(
        { error: "Not Found", message: "Building code not found" },
        { status: 404 }
      );
    }

    // Check if already DEPRECATED
    if (code.status === "DEPRECATED") {
      return NextResponse.json(
        {
          error: "Bad Request",
          message: "Building code is already deprecated.",
          code: "ALREADY_DEPRECATED",
        },
        { status: 400 }
      );
    }

    // Use a transaction to ensure atomicity
    await prisma.$transaction(async (tx) => {
      // Update all PUBLISHED requirements to DEPRECATED
      await tx.codeRequirement.updateMany({
        where: {
          building_code_id: id,
          status: "PUBLISHED",
        },
        data: {
          status: "DEPRECATED",
          updated_at: new Date(),
        },
      });

      // Update building code status to DEPRECATED
      await tx.buildingCode.update({
        where: { id },
        data: {
          status: "DEPRECATED",
        },
      });
    });

    // Fetch updated code with counts
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
          select: { requirements: true },
        },
      },
    });

    return NextResponse.json({
      message: "Building code has been deprecated",
      code: updatedCode,
    });
  } catch (error) {
    console.error("Error deprecating building code:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to deprecate building code" },
      { status: 500 }
    );
  }
}
