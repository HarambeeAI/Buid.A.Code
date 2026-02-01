import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const UuidSchema = z.string().uuid();

/**
 * GET /api/admin/codes/:id
 * Get a building code with its requirements.
 * Admin only (protected by middleware).
 */
export async function GET(
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

    const code = await prisma.buildingCode.findUnique({
      where: { id },
      select: {
        id: true,
        code_id: true,
        name: true,
        region: true,
        version: true,
        status: true,
        description: true,
        source_document_url: true,
        published_at: true,
        created_at: true,
        publisher: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: { requirements: true },
        },
      },
    });

    if (!code) {
      return NextResponse.json(
        { error: "Not Found", message: "Building code not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...code,
      requirement_count: code._count.requirements,
    });
  } catch (error) {
    console.error("Error fetching building code:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to fetch building code" },
      { status: 500 }
    );
  }
}

const UpdateCodeSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  version: z.string().min(1).max(50).optional(),
  description: z.string().max(2000).optional().nullable(),
  source_document_url: z.string().url().optional().nullable(),
});

/**
 * PATCH /api/admin/codes/:id
 * Update a building code.
 * Admin only (protected by middleware).
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
        { error: "Bad Request", message: "Invalid code ID" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validation = UpdateCodeSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Bad Request", message: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    // Check if code exists
    const existing = await prisma.buildingCode.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Not Found", message: "Building code not found" },
        { status: 404 }
      );
    }

    const code = await prisma.buildingCode.update({
      where: { id },
      data: validation.data,
      select: {
        id: true,
        code_id: true,
        name: true,
        region: true,
        version: true,
        status: true,
        description: true,
        source_document_url: true,
        published_at: true,
        created_at: true,
      },
    });

    return NextResponse.json(code);
  } catch (error) {
    console.error("Error updating building code:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to update building code" },
      { status: 500 }
    );
  }
}
