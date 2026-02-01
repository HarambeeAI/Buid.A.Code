import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const UuidSchema = z.string().uuid();

const ListRequirementsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  status: z.enum(["DRAFT", "VERIFIED", "PUBLISHED", "DEPRECATED"]).optional(),
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
});

/**
 * GET /api/admin/codes/:id/requirements
 * List all requirements for a building code.
 * Admin only (protected by middleware).
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
        { error: "Bad Request", message: "Invalid code ID" },
        { status: 400 }
      );
    }

    // Check if code exists
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

    const { searchParams } = new URL(request.url);
    const params = {
      page: searchParams.get("page") || "1",
      limit: searchParams.get("limit") || "50",
      status: searchParams.get("status") || undefined,
      category: searchParams.get("category") || undefined,
    };

    const validation = ListRequirementsSchema.safeParse(params);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Bad Request", message: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { page, limit, status, category } = validation.data;

    const where = {
      building_code_id: id,
      ...(status && { status }),
      ...(category && { category }),
    };

    const [requirements, total] = await Promise.all([
      prisma.codeRequirement.findMany({
        where,
        select: {
          id: true,
          code_ref: true,
          title: true,
          category: true,
          check_type: true,
          status: true,
          source_page: true,
          created_at: true,
          updated_at: true,
        },
        orderBy: [{ status: "asc" }, { code_ref: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.codeRequirement.count({ where }),
    ]);

    // Get status counts
    const statusCounts = await prisma.codeRequirement.groupBy({
      by: ["status"],
      where: { building_code_id: id },
      _count: { status: true },
    });

    const counts = {
      draft: 0,
      verified: 0,
      published: 0,
      deprecated: 0,
    };

    statusCounts.forEach((s) => {
      counts[s.status.toLowerCase() as keyof typeof counts] = s._count.status;
    });

    return NextResponse.json({
      requirements,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
      counts,
    });
  } catch (error) {
    console.error("Error listing requirements:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to list requirements" },
      { status: 500 }
    );
  }
}
