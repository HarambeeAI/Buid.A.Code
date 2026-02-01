import { NextRequest, NextResponse } from "next/server";
import { requireAuth, forbidden } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { randomBytes } from "crypto";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/analyses/:id/share
 * Generates a share token and public URL for an analysis report.
 * Returns existing active token if one exists, or creates a new one.
 */
export async function POST(request: NextRequest, context: RouteContext) {
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
      select: { id: true, tier: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Not Found", message: "User not found" },
        { status: 404 }
      );
    }

    // Fetch analysis with project for ownership check
    const analysis = await prisma.analysis.findUnique({
      where: { id: analysisId },
      select: {
        id: true,
        report_ref: true,
        status: true,
        project: {
          select: {
            user_id: true,
          },
        },
        shareTokens: {
          where: { is_active: true },
          select: {
            id: true,
            token: true,
            created_at: true,
          },
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

    // If there's already an active token, return it
    if (analysis.shareTokens.length > 0) {
      const existingToken = analysis.shareTokens[0];
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
      return NextResponse.json({
        token: existingToken.token,
        url: `${baseUrl}/shared/reports/${existingToken.token}`,
        created_at: existingToken.created_at,
        is_watermarked: user.tier === "FREE",
      });
    }

    // Generate a new secure token (32 bytes = 64 hex chars)
    const token = randomBytes(32).toString("hex");

    // Create the share token
    const shareToken = await prisma.shareToken.create({
      data: {
        analysis_id: analysisId,
        token,
        is_active: true,
      },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

    return NextResponse.json(
      {
        token: shareToken.token,
        url: `${baseUrl}/shared/reports/${shareToken.token}`,
        created_at: shareToken.created_at,
        is_watermarked: user.tier === "FREE",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating share token:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to create share link" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/analyses/:id/share
 * Revokes all active share tokens for an analysis.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
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

    // Fetch analysis with project for ownership check
    const analysis = await prisma.analysis.findUnique({
      where: { id: analysisId },
      select: {
        id: true,
        project: {
          select: {
            user_id: true,
          },
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

    // Deactivate all share tokens for this analysis
    const result = await prisma.shareToken.updateMany({
      where: {
        analysis_id: analysisId,
        is_active: true,
      },
      data: {
        is_active: false,
      },
    });

    return NextResponse.json({
      success: true,
      revoked_count: result.count,
    });
  } catch (error) {
    console.error("Error revoking share tokens:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to revoke share link" },
      { status: 500 }
    );
  }
}
