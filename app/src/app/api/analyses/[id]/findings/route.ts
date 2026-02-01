import { NextRequest, NextResponse } from "next/server";
import { requireAuth, forbidden } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const ListFindingsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
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
  status: z.enum(["COMPLIANT", "WARNING", "CRITICAL", "NOT_ASSESSED"]).optional(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/analyses/:id/findings
 * Returns findings for an analysis, filterable by category and status.
 * Returns 403 if user is not the owner.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { session, response } = await requireAuth(request);
  if (!session) {
    return response;
  }

  const { id: analysisId } = await context.params;

  // Validate UUID format
  if (!z.string().uuid().safeParse(analysisId).success) {
    return NextResponse.json(
      { error: "Bad Request", message: "Invalid analysis ID format" },
      { status: 400 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const params = {
      page: searchParams.get("page") || "1",
      limit: searchParams.get("limit") || "50",
      category: searchParams.get("category") || undefined,
      status: searchParams.get("status") || undefined,
    };

    const validation = ListFindingsSchema.safeParse(params);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Bad Request", message: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { page, limit, category, status } = validation.data;

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

    // Check if analysis exists and verify ownership
    const analysis = await prisma.analysis.findUnique({
      where: { id: analysisId },
      select: {
        id: true,
        project: {
          select: { user_id: true },
        },
      },
    });

    if (!analysis) {
      return NextResponse.json(
        { error: "Not Found", message: "Analysis not found" },
        { status: 404 }
      );
    }

    if (analysis.project.user_id !== user.id) {
      return forbidden("Access denied");
    }

    // Build filter conditions
    const where: {
      analysis_id: string;
      category?: "STRUCTURAL" | "FIRE_SAFETY" | "EGRESS" | "ACCESSIBILITY" | "ENERGY" | "GENERAL_BUILDING" | "SITE" | "PLUMBING" | "ELECTRICAL" | "MECHANICAL";
      status?: "COMPLIANT" | "WARNING" | "CRITICAL" | "NOT_ASSESSED";
    } = {
      analysis_id: analysisId,
    };

    if (category) {
      where.category = category;
    }

    if (status) {
      where.status = status;
    }

    const [findings, total] = await Promise.all([
      prisma.finding.findMany({
        where,
        select: {
          id: true,
          code_reference: true,
          category: true,
          status: true,
          confidence: true,
          description: true,
          required_value: true,
          proposed_value: true,
          page_number: true,
          location: true,
          analysis_notes: true,
          recommendation: true,
          sort_order: true,
        },
        orderBy: { sort_order: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.finding.count({ where }),
    ]);

    return NextResponse.json({
      findings,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching findings:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to fetch findings" },
      { status: 500 }
    );
  }
}
