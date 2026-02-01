import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

const UuidSchema = z.string().uuid();

// Use z.unknown() for JSON fields to satisfy Prisma's InputJsonValue type
const UpdateRequirementSchema = z.object({
  code_ref: z.string().min(1).max(50).optional(),
  title: z.string().min(1).max(500).optional(),
  category: z.enum([
    "STRUCTURAL",
    "FIRE_SAFETY",
    "EGRESS",
    "ACCESSIBILITY",
    "ENERGY",
    "GENERAL_BUILDING",
    "SITE",
    "PLUMBING",
    "ELECTRICAL",
    "MECHANICAL",
  ]).optional(),
  full_text: z.string().min(1).optional(),
  check_type: z.enum([
    "MEASUREMENT_THRESHOLD",
    "PRESENCE_CHECK",
    "RATIO_CHECK",
    "BOOLEAN_CHECK",
  ]).optional(),
  thresholds: z.unknown().optional(),
  applies_to_drawing_types: z.unknown().optional(),
  applies_to_building_types: z.unknown().optional(),
  applies_to_spaces: z.unknown().optional(),
  exceptions: z.unknown().optional(),
  extraction_guidance: z.string().optional(),
  evaluation_guidance: z.string().optional(),
  source_page: z.number().int().positive().nullable().optional(),
  status: z.enum(["DRAFT", "VERIFIED", "PUBLISHED", "DEPRECATED"]).optional(),
});

/**
 * GET /api/admin/requirements/:id
 * Get a single requirement by ID with full details.
 */
export async function GET(
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

    const requirement = await prisma.codeRequirement.findUnique({
      where: { id },
      include: {
        building_code: {
          select: {
            id: true,
            code_id: true,
            name: true,
            region: true,
            status: true,
          },
        },
      },
    });

    if (!requirement) {
      return NextResponse.json(
        { error: "Not Found", message: "Requirement not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(requirement);
  } catch (error) {
    console.error("Error fetching requirement:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to fetch requirement" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/requirements/:id
 * Update a requirement.
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

    // Check requirement exists
    const existing = await prisma.codeRequirement.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Not Found", message: "Requirement not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = UpdateRequirementSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Bad Request", message: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Build update data with proper Prisma types
    const updateData: Prisma.CodeRequirementUpdateInput = {};
    if (data.code_ref !== undefined) updateData.code_ref = data.code_ref;
    if (data.title !== undefined) updateData.title = data.title;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.full_text !== undefined) updateData.full_text = data.full_text;
    if (data.check_type !== undefined) updateData.check_type = data.check_type;
    if (data.thresholds !== undefined) updateData.thresholds = data.thresholds as Prisma.InputJsonValue;
    if (data.applies_to_drawing_types !== undefined) updateData.applies_to_drawing_types = data.applies_to_drawing_types as Prisma.InputJsonValue;
    if (data.applies_to_building_types !== undefined) updateData.applies_to_building_types = data.applies_to_building_types as Prisma.InputJsonValue;
    if (data.applies_to_spaces !== undefined) updateData.applies_to_spaces = data.applies_to_spaces as Prisma.InputJsonValue;
    if (data.exceptions !== undefined) updateData.exceptions = data.exceptions as Prisma.InputJsonValue;
    if (data.extraction_guidance !== undefined) updateData.extraction_guidance = data.extraction_guidance;
    if (data.evaluation_guidance !== undefined) updateData.evaluation_guidance = data.evaluation_guidance;
    if (data.source_page !== undefined) updateData.source_page = data.source_page;
    if (data.status !== undefined) updateData.status = data.status;

    const requirement = await prisma.codeRequirement.update({
      where: { id },
      data: updateData,
      include: {
        building_code: {
          select: {
            id: true,
            code_id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(requirement);
  } catch (error) {
    console.error("Error updating requirement:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to update requirement" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/requirements/:id
 * Delete a requirement.
 */
export async function DELETE(
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

    // Check requirement exists
    const existing = await prisma.codeRequirement.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Not Found", message: "Requirement not found" },
        { status: 404 }
      );
    }

    await prisma.codeRequirement.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting requirement:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to delete requirement" },
      { status: 500 }
    );
  }
}
