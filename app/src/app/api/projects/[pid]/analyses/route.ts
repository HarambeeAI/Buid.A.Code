import { NextRequest, NextResponse } from "next/server";
import { requireAuth, forbidden } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const CreateAnalysisSchema = z.object({
  document_name: z.string().min(1, "Document name is required").max(255),
  document_url: z.string().url("Invalid document URL"),
  document_size: z.number().int().positive("Document size must be positive"),
  document_type: z.enum(["PDF", "PNG", "JPG", "TIFF", "DXF", "IFC"]),
  page_count: z.number().int().positive("Page count must be positive"),
  description: z.string().max(1000).optional().nullable(),
  page_numbers: z.string().max(100).optional().nullable(),
  region: z.enum(["AU", "UK", "US"]),
  selected_codes: z.array(z.string()).min(1, "At least one code must be selected"),
});

/**
 * Generates a report reference in the format BAC-YYYY-NNNNN
 * Uses database sequence for the NNNNN portion to ensure uniqueness
 */
async function generateReportRef(): Promise<string> {
  const year = new Date().getFullYear();

  // Use atomic counter via raw SQL to ensure uniqueness
  const result = await prisma.$queryRaw<[{ nextval: bigint }]>`
    SELECT nextval(pg_get_serial_sequence('analyses', 'id')::regclass)
  `.catch(async () => {
    // If sequence doesn't exist, count existing analyses and add 1
    const count = await prisma.analysis.count();
    return [{ nextval: BigInt(count + 1) }];
  });

  // If the sequence approach fails, fall back to timestamp-based approach
  const sequence = result?.[0]?.nextval ?? BigInt(Date.now() % 100000);
  const paddedNumber = String(sequence).padStart(5, "0").slice(-5);

  return `BAC-${year}-${paddedNumber}`;
}

/**
 * Generates a unique report reference, retrying if collision occurs
 */
async function generateUniqueReportRef(): Promise<string> {
  const maxAttempts = 5;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const year = new Date().getFullYear();
    // Use timestamp + random component for uniqueness
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    const sequence = ((timestamp + random) % 100000);
    const paddedNumber = String(sequence).padStart(5, "0");
    const reportRef = `BAC-${year}-${paddedNumber}`;

    // Check if this report_ref already exists
    const existing = await prisma.analysis.findUnique({
      where: { report_ref: reportRef },
      select: { id: true },
    });

    if (!existing) {
      return reportRef;
    }
  }

  // Final fallback: use UUID-based approach
  const year = new Date().getFullYear();
  const uuid = crypto.randomUUID().replace(/-/g, "").substring(0, 5).toUpperCase();
  return `BAC-${year}-${uuid}`;
}

type RouteContext = {
  params: Promise<{ pid: string }>;
};

/**
 * POST /api/projects/:pid/analyses
 * Creates a new analysis for the authenticated user with tier validation.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { session, response } = await requireAuth(request);
  if (!session) {
    return response;
  }

  try {
    const { pid: projectId } = await context.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(projectId)) {
      return NextResponse.json(
        { error: "Bad Request", message: "Invalid project ID format" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validation = CreateAnalysisSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Bad Request", message: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const {
      document_name,
      document_url,
      document_size,
      document_type,
      page_count,
      description,
      page_numbers,
      region,
      selected_codes,
    } = validation.data;

    // Get user from database with tier info
    const user = await prisma.user.findUnique({
      where: { logto_user_id: session.userId },
      select: {
        id: true,
        tier: true,
        analyses_remaining: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Not Found", message: "User not found" },
        { status: 404 }
      );
    }

    // Verify project belongs to user
    const project = await prisma.project.findFirst({
      where: { id: projectId, user_id: user.id },
      select: { id: true },
    });

    if (!project) {
      return forbidden("Project not found or access denied");
    }

    // Tier-based validation
    const isFree = user.tier === "FREE";

    if (isFree) {
      // FREE tier: page_count <= 5
      if (page_count > 5) {
        return NextResponse.json(
          {
            error: "Forbidden",
            message: "Free tier is limited to 5 pages per document. Upgrade to Pro for up to 50 pages.",
            code: "PAGE_LIMIT_EXCEEDED",
            limit: 5,
            requested: page_count,
          },
          { status: 403 }
        );
      }

      // FREE tier: codes <= 3
      if (selected_codes.length > 3) {
        return NextResponse.json(
          {
            error: "Forbidden",
            message: "Free tier is limited to 3 building codes per analysis. Upgrade to Pro for unlimited codes.",
            code: "CODE_LIMIT_EXCEEDED",
            limit: 3,
            requested: selected_codes.length,
          },
          { status: 403 }
        );
      }

      // FREE tier: analyses_remaining > 0
      if (user.analyses_remaining !== null && user.analyses_remaining <= 0) {
        return NextResponse.json(
          {
            error: "Forbidden",
            message: "You have used all your free analyses. Upgrade to Pro for unlimited analyses.",
            code: "ANALYSES_EXHAUSTED",
            remaining: 0,
          },
          { status: 403 }
        );
      }
    } else {
      // PRO tier: page_count <= 50
      if (page_count > 50) {
        return NextResponse.json(
          {
            error: "Forbidden",
            message: "Pro tier is limited to 50 pages per document.",
            code: "PAGE_LIMIT_EXCEEDED",
            limit: 50,
            requested: page_count,
          },
          { status: 403 }
        );
      }
      // PRO tier: no code limit
    }

    // Generate unique report reference
    const reportRef = await generateUniqueReportRef();

    // Create analysis and decrement remaining analyses in a transaction
    const analysis = await prisma.$transaction(async (tx) => {
      // Decrement analyses_remaining for FREE tier users
      if (isFree && user.analyses_remaining !== null) {
        await tx.user.update({
          where: { id: user.id },
          data: { analyses_remaining: user.analyses_remaining - 1 },
        });
      }

      // Create the analysis
      return tx.analysis.create({
        data: {
          project_id: projectId,
          report_ref: reportRef,
          document_name,
          document_url,
          document_size,
          document_type,
          page_count,
          description: description || null,
          page_numbers: page_numbers || null,
          region,
          selected_codes,
          status: "PENDING",
        },
        select: {
          id: true,
          report_ref: true,
          document_name: true,
          document_url: true,
          document_size: true,
          document_type: true,
          page_count: true,
          description: true,
          page_numbers: true,
          region: true,
          selected_codes: true,
          status: true,
          created_at: true,
        },
      });
    });

    return NextResponse.json(analysis, { status: 201 });
  } catch (error) {
    console.error("Error creating analysis:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to create analysis" },
      { status: 500 }
    );
  }
}

const ListAnalysesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * GET /api/projects/:pid/analyses
 * Lists analyses for a project.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { session, response } = await requireAuth(request);
  if (!session) {
    return response;
  }

  try {
    const { pid: projectId } = await context.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(projectId)) {
      return NextResponse.json(
        { error: "Bad Request", message: "Invalid project ID format" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const params = {
      page: searchParams.get("page") || "1",
      limit: searchParams.get("limit") || "20",
    };

    const validation = ListAnalysesSchema.safeParse(params);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Bad Request", message: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { page, limit } = validation.data;

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { logto_user_id: session.userId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Not Found", message: "User not found" },
        { status: 404 }
      );
    }

    // Verify project belongs to user
    const project = await prisma.project.findFirst({
      where: { id: projectId, user_id: user.id },
      select: { id: true },
    });

    if (!project) {
      return forbidden("Project not found or access denied");
    }

    const where = { project_id: projectId };

    const [analyses, total] = await Promise.all([
      prisma.analysis.findMany({
        where,
        select: {
          id: true,
          report_ref: true,
          document_name: true,
          document_type: true,
          page_count: true,
          region: true,
          status: true,
          compliance_score: true,
          overall_status: true,
          critical_count: true,
          warning_count: true,
          compliant_count: true,
          created_at: true,
          completed_at: true,
        },
        orderBy: { created_at: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.analysis.count({ where }),
    ]);

    return NextResponse.json({
      analyses,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error listing analyses:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to list analyses" },
      { status: 500 }
    );
  }
}
