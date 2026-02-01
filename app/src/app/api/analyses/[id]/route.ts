import { NextRequest, NextResponse } from "next/server";
import { requireAuth, forbidden } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/analyses/:id
 * Returns analysis detail. Returns 403 if user is not the owner.
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
      { error: "Bad Request", message: "Invalid analysis ID format" },
      { status: 400 }
    );
  }

  try {
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

    const analysis = await prisma.analysis.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            user_id: true,
          },
        },
        _count: {
          select: { findings: true },
        },
      },
    });

    if (!analysis) {
      return NextResponse.json(
        { error: "Not Found", message: "Analysis not found" },
        { status: 404 }
      );
    }

    // Check ownership via project
    if (analysis.project.user_id !== user.id) {
      return forbidden("Access denied");
    }

    // Transform response
    return NextResponse.json({
      id: analysis.id,
      report_ref: analysis.report_ref,
      document_name: analysis.document_name,
      document_url: analysis.document_url,
      document_size: analysis.document_size,
      document_type: analysis.document_type,
      page_count: analysis.page_count,
      description: analysis.description,
      page_numbers: analysis.page_numbers,
      region: analysis.region,
      selected_codes: analysis.selected_codes,
      status: analysis.status,
      current_stage: analysis.current_stage,
      compliance_score: analysis.compliance_score,
      overall_status: analysis.overall_status,
      critical_count: analysis.critical_count,
      warning_count: analysis.warning_count,
      compliant_count: analysis.compliant_count,
      not_assessed_count: analysis.not_assessed_count,
      total_checks: analysis.total_checks,
      started_at: analysis.started_at,
      completed_at: analysis.completed_at,
      created_at: analysis.created_at,
      project: {
        id: analysis.project.id,
        name: analysis.project.name,
      },
      finding_count: analysis._count.findings,
    });
  } catch (error) {
    console.error("Error fetching analysis:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to fetch analysis" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/analyses/:id
 * Deletes an analysis and cascades to related findings and share tokens.
 * Returns 403 if user is not the owner.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const { session, response } = await requireAuth(request);
  if (!session) {
    return response;
  }

  const { id } = await context.params;

  // Validate UUID format
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json(
      { error: "Bad Request", message: "Invalid analysis ID format" },
      { status: 400 }
    );
  }

  try {
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

    // Check if analysis exists and get project for ownership check
    const analysis = await prisma.analysis.findUnique({
      where: { id },
      select: {
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

    // Delete analysis (cascade will handle findings and share tokens)
    await prisma.analysis.delete({
      where: { id },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error deleting analysis:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to delete analysis" },
      { status: 500 }
    );
  }
}
