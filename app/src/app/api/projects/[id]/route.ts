import { NextRequest, NextResponse } from "next/server";
import { requireAuth, forbidden } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional().nullable(),
  folder_id: z.string().uuid().optional().nullable(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/projects/:id
 * Returns project detail. Returns 403 if user is not the owner.
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
      { error: "Bad Request", message: "Invalid project ID format" },
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

    const project = await prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        folder_id: true,
        user_id: true,
        created_at: true,
        updated_at: true,
        _count: {
          select: { analyses: true },
        },
        folder: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Not Found", message: "Project not found" },
        { status: 404 }
      );
    }

    // Check ownership
    if (project.user_id !== user.id) {
      return forbidden("Access denied");
    }

    // Transform response
    return NextResponse.json({
      id: project.id,
      name: project.name,
      description: project.description,
      folder_id: project.folder_id,
      folder: project.folder,
      created_at: project.created_at,
      updated_at: project.updated_at,
      analysis_count: project._count.analyses,
    });
  } catch (error) {
    console.error("Error fetching project:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to fetch project" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/projects/:id
 * Updates a project. Returns 403 if user is not the owner.
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
      { error: "Bad Request", message: "Invalid project ID format" },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const validation = UpdateProjectSchema.safeParse(body);

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

    // Check if project exists and user owns it
    const existingProject = await prisma.project.findUnique({
      where: { id },
      select: { user_id: true },
    });

    if (!existingProject) {
      return NextResponse.json(
        { error: "Not Found", message: "Project not found" },
        { status: 404 }
      );
    }

    if (existingProject.user_id !== user.id) {
      return forbidden("Access denied");
    }

    const { name, description, folder_id } = validation.data;

    // If folder_id provided, verify it belongs to the user
    if (folder_id !== undefined && folder_id !== null) {
      const folder = await prisma.folder.findFirst({
        where: { id: folder_id, user_id: user.id },
      });
      if (!folder) {
        return forbidden("Folder not found or access denied");
      }
    }

    // Build update data - only include fields that were provided
    const updateData: { name?: string; description?: string | null; folder_id?: string | null } = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (folder_id !== undefined) updateData.folder_id = folder_id;

    const project = await prisma.project.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        description: true,
        folder_id: true,
        created_at: true,
        updated_at: true,
        _count: {
          select: { analyses: true },
        },
      },
    });

    return NextResponse.json({
      id: project.id,
      name: project.name,
      description: project.description,
      folder_id: project.folder_id,
      created_at: project.created_at,
      updated_at: project.updated_at,
      analysis_count: project._count.analyses,
    });
  } catch (error) {
    console.error("Error updating project:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to update project" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/:id
 * Deletes a project and cascades to related analyses. Returns 403 if user is not the owner.
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
      { error: "Bad Request", message: "Invalid project ID format" },
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

    // Check if project exists and user owns it
    const existingProject = await prisma.project.findUnique({
      where: { id },
      select: { user_id: true },
    });

    if (!existingProject) {
      return NextResponse.json(
        { error: "Not Found", message: "Project not found" },
        { status: 404 }
      );
    }

    if (existingProject.user_id !== user.id) {
      return forbidden("Access denied");
    }

    // Delete project (cascade will handle analyses, findings, share tokens)
    await prisma.project.delete({
      where: { id },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error deleting project:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to delete project" },
      { status: 500 }
    );
  }
}
