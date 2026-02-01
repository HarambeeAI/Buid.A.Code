import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const UpdateCodeRequestSchema = z.object({
  status: z
    .enum(["SUBMITTED", "UNDER_REVIEW", "IN_PROGRESS", "PUBLISHED", "DECLINED"])
    .optional(),
  admin_notes: z.string().max(2000).nullable().optional(),
  resolved_code_id: z.string().uuid().nullable().optional(),
});

/**
 * GET /api/admin/code-requests/:id
 * Gets a single code request with full details.
 * Admin only (protected by middleware).
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: "Bad Request", message: "Invalid code request ID format" },
        { status: 400 }
      );
    }

    const codeRequest = await prisma.codeRequest.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        resolvedCode: {
          select: {
            id: true,
            code_id: true,
            name: true,
            region: true,
            version: true,
            status: true,
          },
        },
      },
    });

    if (!codeRequest) {
      return NextResponse.json(
        { error: "Not Found", message: "Code request not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(codeRequest);
  } catch (error) {
    console.error("Error fetching code request:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to fetch code request" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/code-requests/:id
 * Updates a code request status, admin_notes, or resolved_code_id.
 * Admin only (protected by middleware).
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: "Bad Request", message: "Invalid code request ID format" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validation = UpdateCodeRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Bad Request", message: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { status, admin_notes, resolved_code_id } = validation.data;

    // Check if code request exists
    const existing = await prisma.codeRequest.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Not Found", message: "Code request not found" },
        { status: 404 }
      );
    }

    // If resolved_code_id is provided, verify the building code exists
    if (resolved_code_id) {
      const buildingCode = await prisma.buildingCode.findUnique({
        where: { id: resolved_code_id },
      });

      if (!buildingCode) {
        return NextResponse.json(
          { error: "Bad Request", message: "Resolved building code not found" },
          { status: 400 }
        );
      }
    }

    // Build update data
    const updateData: {
      status?: "SUBMITTED" | "UNDER_REVIEW" | "IN_PROGRESS" | "PUBLISHED" | "DECLINED";
      admin_notes?: string | null;
      resolved_code_id?: string | null;
    } = {};

    if (status !== undefined) {
      updateData.status = status;
    }
    if (admin_notes !== undefined) {
      updateData.admin_notes = admin_notes;
    }
    if (resolved_code_id !== undefined) {
      updateData.resolved_code_id = resolved_code_id;
    }

    const updated = await prisma.codeRequest.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        resolvedCode: {
          select: {
            id: true,
            code_id: true,
            name: true,
            region: true,
            version: true,
            status: true,
          },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating code request:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to update code request" },
      { status: 500 }
    );
  }
}
