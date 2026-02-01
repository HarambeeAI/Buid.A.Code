import { NextRequest, NextResponse } from "next/server";
import { requireAuth, forbidden } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const UpdateFolderSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * PATCH /api/folders/:id
 * Renames a folder. Returns 403 if user is not the owner.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { session, response } = await requireAuth(request);
  if (!session) {
    return response;
  }

  const { id } = await context.params;

  // Validate UUID format
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json(
      { error: "Bad Request", message: "Invalid folder ID format" },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const validation = UpdateFolderSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Bad Request", message: validation.error.issues[0].message },
        { status: 400 }
      );
    }

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

    // Check if folder exists and user owns it
    const existingFolder = await prisma.folder.findUnique({
      where: { id },
      select: { user_id: true },
    });

    if (!existingFolder) {
      return NextResponse.json(
        { error: "Not Found", message: "Folder not found" },
        { status: 404 }
      );
    }

    if (existingFolder.user_id !== user.id) {
      return forbidden("Access denied");
    }

    const { name } = validation.data;

    const folder = await prisma.folder.update({
      where: { id },
      data: { name },
      select: {
        id: true,
        name: true,
        created_at: true,
        _count: {
          select: { projects: true },
        },
      },
    });

    return NextResponse.json({
      id: folder.id,
      name: folder.name,
      created_at: folder.created_at,
      project_count: folder._count.projects,
    });
  } catch (error) {
    console.error("Error updating folder:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to update folder" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/folders/:id
 * Deletes a folder. Projects in the folder get folder_id set to null.
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
      { error: "Bad Request", message: "Invalid folder ID format" },
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

    // Check if folder exists and user owns it
    const existingFolder = await prisma.folder.findUnique({
      where: { id },
      select: { user_id: true },
    });

    if (!existingFolder) {
      return NextResponse.json(
        { error: "Not Found", message: "Folder not found" },
        { status: 404 }
      );
    }

    if (existingFolder.user_id !== user.id) {
      return forbidden("Access denied");
    }

    // Set folder_id to null for all projects in this folder, then delete the folder
    // This is done in a transaction to ensure consistency
    await prisma.$transaction([
      prisma.project.updateMany({
        where: { folder_id: id },
        data: { folder_id: null },
      }),
      prisma.folder.delete({
        where: { id },
      }),
    ]);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error deleting folder:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to delete folder" },
      { status: 500 }
    );
  }
}
