import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { Region } from "@prisma/client";

const CreateCodeRequestSchema = z.object({
  code_name: z.string().min(1, "Code name is required").max(255),
  region: z.enum(["AU", "UK", "US"], {
    message: "Region must be AU, UK, or US",
  }),
  description: z.string().max(2000).optional(),
  reference_url: z.string().url("Invalid URL format").optional().or(z.literal("")),
});

/**
 * POST /api/code-requests
 * Creates a new code request with status SUBMITTED.
 */
export async function POST(request: NextRequest) {
  const { session, response } = await requireAuth(request);
  if (!session) {
    return response;
  }

  try {
    const body = await request.json();
    const validation = CreateCodeRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Bad Request", message: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { code_name, region, description, reference_url } = validation.data;

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

    const codeRequest = await prisma.codeRequest.create({
      data: {
        user_id: user.id,
        code_name,
        region: region as Region,
        description: description || null,
        reference_url: reference_url || null,
        // status defaults to SUBMITTED via Prisma schema
      },
      select: {
        id: true,
        code_name: true,
        region: true,
        description: true,
        reference_url: true,
        status: true,
        created_at: true,
      },
    });

    return NextResponse.json(codeRequest, { status: 201 });
  } catch (error) {
    console.error("Error creating code request:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to create code request" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/code-requests
 * Lists all code requests for the authenticated user with status.
 */
export async function GET(request: NextRequest) {
  const { session, response } = await requireAuth(request);
  if (!session) {
    return response;
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

    const codeRequests = await prisma.codeRequest.findMany({
      where: { user_id: user.id },
      select: {
        id: true,
        code_name: true,
        region: true,
        description: true,
        reference_url: true,
        status: true,
        admin_notes: true,
        created_at: true,
        updated_at: true,
        resolvedCode: {
          select: {
            id: true,
            code_id: true,
            name: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
    });

    return NextResponse.json({ code_requests: codeRequests });
  } catch (error) {
    console.error("Error listing code requests:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to list code requests" },
      { status: 500 }
    );
  }
}
