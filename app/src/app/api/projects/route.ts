import { NextRequest, NextResponse } from "next/server";
import { requireAuth, forbidden } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const CreateProjectSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().max(1000).optional(),
  folder_id: z.string().uuid().optional().nullable(),
});

/**
 * POST /api/projects
 * Creates a new project for the authenticated user.
 */
export async function POST(request: NextRequest) {
  const { session, response } = await requireAuth(request);
  if (!session) {
    return response;
  }

  try {
    const body = await request.json();
    const validation = CreateProjectSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Bad Request", message: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { name, description, folder_id } = validation.data;

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

    // If folder_id provided, verify it belongs to the user
    if (folder_id) {
      const folder = await prisma.folder.findFirst({
        where: { id: folder_id, user_id: user.id },
      });
      if (!folder) {
        return forbidden("Folder not found or access denied");
      }
    }

    const project = await prisma.project.create({
      data: {
        name,
        description,
        folder_id: folder_id || null,
        user_id: user.id,
      },
      select: {
        id: true,
        name: true,
        description: true,
        folder_id: true,
        created_at: true,
        updated_at: true,
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error("Error creating project:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to create project" },
      { status: 500 }
    );
  }
}

const ListProjectsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  folder_id: z.string().uuid().optional(),
});

/**
 * GET /api/projects
 * Lists projects for the authenticated user with pagination and analysis count.
 */
export async function GET(request: NextRequest) {
  const { session, response } = await requireAuth(request);
  if (!session) {
    return response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const params = {
      page: searchParams.get("page") || "1",
      limit: searchParams.get("limit") || "20",
      folder_id: searchParams.get("folder_id") || undefined,
    };

    const validation = ListProjectsSchema.safeParse(params);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Bad Request", message: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { page, limit, folder_id } = validation.data;

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

    const where = {
      user_id: user.id,
      ...(folder_id && { folder_id }),
    };

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
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
        orderBy: { updated_at: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.project.count({ where }),
    ]);

    // Transform to include analysis_count at top level
    const transformedProjects = projects.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      folder_id: p.folder_id,
      created_at: p.created_at,
      updated_at: p.updated_at,
      analysis_count: p._count.analyses,
    }));

    return NextResponse.json({
      projects: transformedProjects,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error listing projects:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to list projects" },
      { status: 500 }
    );
  }
}
