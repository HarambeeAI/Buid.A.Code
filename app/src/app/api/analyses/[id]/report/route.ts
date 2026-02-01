import { NextRequest, NextResponse } from "next/server";
import { requireAuth, forbidden } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/analyses/:id/report
 * Returns the full report payload for an analysis.
 * Includes analysis details, all findings grouped by category, and summary stats.
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

    // Fetch analysis with project and all findings
    const analysis = await prisma.analysis.findUnique({
      where: { id: analysisId },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            user_id: true,
          },
        },
        findings: {
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

    // Group findings by category
    const findingsByCategory: Record<string, typeof analysis.findings> = {};
    for (const finding of analysis.findings) {
      if (!findingsByCategory[finding.category]) {
        findingsByCategory[finding.category] = [];
      }
      findingsByCategory[finding.category].push(finding);
    }

    // Build summary statistics
    const summary = {
      total_findings: analysis.findings.length,
      critical_count: analysis.critical_count,
      warning_count: analysis.warning_count,
      compliant_count: analysis.compliant_count,
      not_assessed_count: analysis.not_assessed_count,
      total_checks: analysis.total_checks,
      compliance_score: analysis.compliance_score,
      overall_status: analysis.overall_status,
    };

    // Get counts by confidence
    const confidenceCounts = {
      high: analysis.findings.filter((f) => f.confidence === "HIGH").length,
      medium: analysis.findings.filter((f) => f.confidence === "MEDIUM").length,
      low: analysis.findings.filter((f) => f.confidence === "LOW").length,
    };

    return NextResponse.json({
      report_ref: analysis.report_ref,
      document_name: analysis.document_name,
      document_url: analysis.document_url,
      document_type: analysis.document_type,
      page_count: analysis.page_count,
      description: analysis.description,
      region: analysis.region,
      selected_codes: analysis.selected_codes,
      status: analysis.status,
      started_at: analysis.started_at,
      completed_at: analysis.completed_at,
      created_at: analysis.created_at,
      project: {
        id: analysis.project.id,
        name: analysis.project.name,
      },
      summary,
      confidence_breakdown: confidenceCounts,
      findings_by_category: findingsByCategory,
      findings: analysis.findings,
    });
  } catch (error) {
    console.error("Error fetching report:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to fetch report" },
      { status: 500 }
    );
  }
}
