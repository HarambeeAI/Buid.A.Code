import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";

type RouteContext = {
  params: Promise<{ token: string }>;
};

/**
 * GET /shared/reports/:token
 * Public read-only endpoint for viewing shared analysis reports.
 * No authentication required.
 * Returns report data with watermark indicator based on owner's tier.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { token } = await context.params;

  // Validate token format (64 hex chars)
  if (!z.string().length(64).regex(/^[a-f0-9]+$/).safeParse(token).success) {
    return NextResponse.json(
      { error: "Bad Request", message: "Invalid share token format" },
      { status: 400 }
    );
  }

  try {
    // Find the share token and ensure it's active
    const shareToken = await prisma.shareToken.findUnique({
      where: { token },
      select: {
        id: true,
        is_active: true,
        created_at: true,
        analysis: {
          select: {
            id: true,
            report_ref: true,
            document_name: true,
            document_type: true,
            page_count: true,
            description: true,
            region: true,
            selected_codes: true,
            status: true,
            compliance_score: true,
            overall_status: true,
            critical_count: true,
            warning_count: true,
            compliant_count: true,
            not_assessed_count: true,
            total_checks: true,
            started_at: true,
            completed_at: true,
            created_at: true,
            project: {
              select: {
                name: true,
                user: {
                  select: {
                    tier: true,
                  },
                },
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
        },
      },
    });

    // Token not found
    if (!shareToken) {
      return NextResponse.json(
        { error: "Not Found", message: "Share link not found or has expired" },
        { status: 404 }
      );
    }

    // Token has been revoked
    if (!shareToken.is_active) {
      return NextResponse.json(
        { error: "Gone", message: "This share link has been revoked" },
        { status: 410 }
      );
    }

    const analysis = shareToken.analysis;

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

    // Determine if watermark should be shown (FREE tier owners)
    const isWatermarked = analysis.project.user.tier === "FREE";

    return NextResponse.json({
      report_ref: analysis.report_ref,
      document_name: analysis.document_name,
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
        name: analysis.project.name,
      },
      summary,
      confidence_breakdown: confidenceCounts,
      findings_by_category: findingsByCategory,
      findings: analysis.findings,
      // Share metadata
      is_shared: true,
      is_watermarked: isWatermarked,
      shared_at: shareToken.created_at,
    });
  } catch (error) {
    console.error("Error fetching shared report:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to fetch report" },
      { status: 500 }
    );
  }
}
