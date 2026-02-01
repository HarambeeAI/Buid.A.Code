import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const CreateFolderSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
});

/**
 * POST /api/folders
 * Creates a new folder for the authenticated user.
 */
export async function POST(request: NextRequest) {
  const { session, response } = await requireAuth(request);
  if (!session) {
    return response;
  }

  try {
    const body = await request.json();
    const validation = CreateFolderSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Bad Request", message: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { name } = validation.data;

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

    const folder = await prisma.folder.create({
      data: {
        name,
        user_id: user.id,
      },
      select: {
        id: true,
        name: true,
        created_at: true,
      },
    });

    return NextResponse.json(folder, { status: 201 });
  } catch (error) {
    console.error("Error creating folder:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to create folder" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/folders
 * Lists all folders for the authenticated user.
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

    const folders = await prisma.folder.findMany({
      where: { user_id: user.id },
      select: {
        id: true,
        name: true,
        created_at: true,
        _count: {
          select: { projects: true },
        },
      },
      orderBy: { name: "asc" },
    });

    // Transform to include project_count at top level
    const transformedFolders = folders.map((f) => ({
      id: f.id,
      name: f.name,
      created_at: f.created_at,
      project_count: f._count.projects,
    }));

    return NextResponse.json({ folders: transformedFolders });
  } catch (error) {
    console.error("Error listing folders:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to list folders" },
      { status: 500 }
    );
  }
}
