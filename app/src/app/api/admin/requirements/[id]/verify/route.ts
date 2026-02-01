import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const UuidSchema = z.string().uuid();

/**
 * PATCH /api/admin/requirements/:id/verify
 * Mark a single requirement as VERIFIED.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const idValidation = UuidSchema.safeParse(id);
    if (!idValidation.success) {
      return NextResponse.json(
        { error: "Bad Request", message: "Invalid requirement ID" },
        { status: 400 }
      );
    }

    // Check requirement exists and is in DRAFT status
    const existing = await prisma.codeRequirement.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Not Found", message: "Requirement not found" },
        { status: 404 }
      );
    }

    if (existing.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Bad Request", message: `Cannot verify requirement with status ${existing.status}` },
        { status: 400 }
      );
    }

    const requirement = await prisma.codeRequirement.update({
      where: { id },
      data: { status: "VERIFIED" },
      select: {
        id: true,
        code_ref: true,
        title: true,
        status: true,
      },
    });

    return NextResponse.json(requirement);
  } catch (error) {
    console.error("Error verifying requirement:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to verify requirement" },
      { status: 500 }
    );
  }
}
