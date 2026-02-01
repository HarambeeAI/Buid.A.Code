import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const ListCodesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  region: z.enum(["AU", "UK", "US"]).optional(),
  status: z.enum(["DRAFT", "ACTIVE", "DEPRECATED"]).optional(),
});

/**
 * GET /api/admin/codes
 * Lists all building codes with requirement count.
 * Admin only (protected by middleware).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const params = {
      page: searchParams.get("page") || "1",
      limit: searchParams.get("limit") || "20",
      region: searchParams.get("region") || undefined,
      status: searchParams.get("status") || undefined,
    };

    const validation = ListCodesSchema.safeParse(params);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Bad Request", message: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { page, limit, region, status } = validation.data;

    const where = {
      ...(region && { region: region as "AU" | "UK" | "US" }),
      ...(status && {
        status: status as "DRAFT" | "ACTIVE" | "DEPRECATED",
      }),
    };

    const [codes, total] = await Promise.all([
      prisma.buildingCode.findMany({
        where,
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
          _count: {
            select: { requirements: true },
          },
          publisher: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: [{ region: "asc" }, { name: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.buildingCode.count({ where }),
    ]);

    // Transform to include requirement_count at top level
    const transformedCodes = codes.map((c) => ({
      id: c.id,
      code_id: c.code_id,
      name: c.name,
      region: c.region,
      version: c.version,
      status: c.status,
      description: c.description,
      source_document_url: c.source_document_url,
      published_at: c.published_at,
      created_at: c.created_at,
      requirement_count: c._count.requirements,
      publisher: c.publisher,
    }));

    return NextResponse.json({
      codes: transformedCodes,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error listing building codes:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to list building codes" },
      { status: 500 }
    );
  }
}

const CreateCodeSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  code_id: z
    .string()
    .min(1, "Code ID is required")
    .max(50)
    .regex(/^[A-Z0-9-]+$/, "Code ID must be uppercase letters, numbers, and hyphens only"),
  region: z.enum(["AU", "UK", "US"], {
    message: "Region must be AU, UK, or US",
  }),
  version: z.string().min(1, "Version is required").max(50),
  description: z.string().max(2000).optional(),
});

/**
 * POST /api/admin/codes
 * Creates a new building code with DRAFT status.
 * Admin only (protected by middleware).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = CreateCodeSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Bad Request", message: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { name, code_id, region, version, description } = validation.data;

    // Check for duplicate code_id
    const existing = await prisma.buildingCode.findUnique({
      where: { code_id },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Conflict", message: `Building code with ID '${code_id}' already exists` },
        { status: 409 }
      );
    }

    const code = await prisma.buildingCode.create({
      data: {
        name,
        code_id,
        region,
        version,
        description,
        status: "DRAFT",
      },
      select: {
        id: true,
        code_id: true,
        name: true,
        region: true,
        version: true,
        status: true,
        description: true,
        created_at: true,
      },
    });

    return NextResponse.json(code, { status: 201 });
  } catch (error) {
    console.error("Error creating building code:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to create building code" },
      { status: 500 }
    );
  }
}
