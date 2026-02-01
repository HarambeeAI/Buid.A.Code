import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/analyses/:id/status
 * Lightweight polling endpoint returning only status-related fields.
 * Optimized for < 50ms response time.
 * Returns 404 if analysis not found or not owned by user.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { session, response } = await requireAuth(request);
  if (!session) {
    return response;
  }

  const { id } = await context.params;

  // Validate UUID format
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json(
      { error: "Not Found", message: "Analysis not found" },
      { status: 404 }
    );
  }

  try {
    // Get user from database (minimal query)
    const user = await prisma.user.findUnique({
      where: { logto_user_id: session.userId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Not Found", message: "Analysis not found" },
        { status: 404 }
      );
    }

    // Minimal query - only status fields and ownership check
    const analysis = await prisma.analysis.findUnique({
      where: { id },
      select: {
        status: true,
        current_stage: true,
        compliance_score: true,
        overall_status: true,
        total_checks: true,
        started_at: true,
        completed_at: true,
        created_at: true,
        project: {
          select: {
            user_id: true,
          },
        },
      },
    });

    // Return 404 for both not found and not owned (don't leak existence info)
    if (!analysis || analysis.project.user_id !== user.id) {
      return NextResponse.json(
        { error: "Not Found", message: "Analysis not found" },
        { status: 404 }
      );
    }

    // Return only status-related fields
    return NextResponse.json({
      status: analysis.status,
      current_stage: analysis.current_stage,
      compliance_score: analysis.compliance_score,
      overall_status: analysis.overall_status,
      total_checks: analysis.total_checks,
      started_at: analysis.started_at,
      completed_at: analysis.completed_at,
      created_at: analysis.created_at,
    });
  } catch (error) {
    console.error("Error fetching analysis status:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to fetch analysis status" },
      { status: 500 }
    );
  }
}
