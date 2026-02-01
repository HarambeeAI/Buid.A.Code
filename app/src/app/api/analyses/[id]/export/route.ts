import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { renderToBuffer } from "@react-pdf/renderer";
import { createReportElement, type ReportData, type Finding } from "@/lib/pdf-report";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/analyses/:id/export
 * Generates a professional PDF compliance report.
 * Pro tier only - FREE users receive 403 with upgrade message.
 * Filename: BuildACode_Report_{report_ref}.pdf
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
    // Get user from database with tier info
    const user = await prisma.user.findUnique({
      where: { logto_user_id: session.userId },
      select: { id: true, tier: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Not Found", message: "User not found" },
        { status: 404 }
      );
    }

    // Check tier - PRO only
    if (user.tier !== "PRO") {
      return NextResponse.json(
        {
          error: "Forbidden",
          message: "PDF export requires a Pro subscription. Upgrade to unlock unlimited PDF exports with professional formatting.",
          code: "UPGRADE_REQUIRED",
          upgrade_url: "/upgrade",
        },
        { status: 403 }
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
      return NextResponse.json(
        { error: "Not Found", message: "Analysis not found" },
        { status: 404 }
      );
    }

    // Check analysis is complete
    if (analysis.status !== "COMPLETED") {
      return NextResponse.json(
        {
          error: "Bad Request",
          message: "Cannot export report for analysis that is not completed",
          status: analysis.status,
        },
        { status: 400 }
      );
    }

    // Group findings by category
    const findingsByCategory: Record<string, Finding[]> = {};
    for (const finding of analysis.findings) {
      const category = finding.category;
      if (!findingsByCategory[category]) {
        findingsByCategory[category] = [];
      }
      findingsByCategory[category].push({
        id: finding.id,
        code_reference: finding.code_reference,
        category: finding.category,
        status: finding.status as Finding["status"],
        confidence: finding.confidence as Finding["confidence"],
        description: finding.description,
        required_value: finding.required_value,
        proposed_value: finding.proposed_value,
        page_number: finding.page_number,
        location: finding.location,
        analysis_notes: finding.analysis_notes,
        recommendation: finding.recommendation,
      });
    }

    // Build report data
    const reportData: ReportData = {
      report_ref: analysis.report_ref,
      document_name: analysis.document_name,
      page_count: analysis.page_count,
      region: analysis.region,
      selected_codes: analysis.selected_codes as string[],
      overall_status: analysis.overall_status as ReportData["overall_status"],
      compliance_score: analysis.compliance_score,
      started_at: analysis.started_at,
      completed_at: analysis.completed_at,
      created_at: analysis.created_at,
      project: {
        name: analysis.project.name,
      },
      summary: {
        total_findings: analysis.findings.length,
        critical_count: analysis.critical_count,
        warning_count: analysis.warning_count,
        compliant_count: analysis.compliant_count,
        not_assessed_count: analysis.not_assessed_count,
        total_checks: analysis.total_checks,
      },
      findings_by_category: findingsByCategory,
    };

    // Generate PDF
    const pdfBuffer = await renderToBuffer(createReportElement(reportData));

    // Create filename
    const filename = `BuildACode_Report_${analysis.report_ref}.pdf`;

    // Convert to Uint8Array for NextResponse
    const uint8Array = new Uint8Array(pdfBuffer);

    // Return PDF response
    return new NextResponse(uint8Array, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": uint8Array.length.toString(),
      },
    });
  } catch (error) {
    console.error("Error generating PDF export:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to generate PDF report" },
      { status: 500 }
    );
  }
}
