import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const ListCodeRequestsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["SUBMITTED", "UNDER_REVIEW", "IN_PROGRESS", "PUBLISHED", "DECLINED"]).optional(),
  grouped: z.coerce.boolean().default(true),
});

/**
 * GET /api/admin/code-requests
 * Lists all code requests with optional grouping by code_name.
 * Admin only (protected by middleware).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const params = {
      page: searchParams.get("page") || "1",
      limit: searchParams.get("limit") || "20",
      status: searchParams.get("status") || undefined,
      grouped: searchParams.get("grouped") ?? "true",
    };

    const validation = ListCodeRequestsSchema.safeParse(params);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Bad Request", message: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { page, limit, status, grouped } = validation.data;

    const where = {
      ...(status && {
        status: status as "SUBMITTED" | "UNDER_REVIEW" | "IN_PROGRESS" | "PUBLISHED" | "DECLINED",
      }),
    };

    if (grouped) {
      // Get unique code_names with request counts, sorted by count desc
      const groupedRequests = await prisma.codeRequest.groupBy({
        by: ["code_name", "region"],
        where,
        _count: {
          id: true,
        },
        orderBy: {
          _count: {
            id: "desc",
          },
        },
        skip: (page - 1) * limit,
        take: limit,
      });

      // Get total unique code_name + region combinations for pagination
      const allGroups = await prisma.codeRequest.groupBy({
        by: ["code_name", "region"],
        where,
      });
      const total = allGroups.length;

      // For each group, get the most recent request and all statuses
      const groupsWithDetails = await Promise.all(
        groupedRequests.map(async (group) => {
          const requests = await prisma.codeRequest.findMany({
            where: {
              code_name: group.code_name,
              region: group.region,
              ...where,
            },
            orderBy: { created_at: "desc" },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
              resolvedCode: {
                select: {
                  id: true,
                  code_id: true,
                  name: true,
                },
              },
            },
          });

          // Get status distribution
          const statusCounts = requests.reduce(
            (acc, req) => {
              acc[req.status] = (acc[req.status] || 0) + 1;
              return acc;
            },
            {} as Record<string, number>
          );

          return {
            code_name: group.code_name,
            region: group.region,
            request_count: group._count.id,
            status_counts: statusCounts,
            most_recent: requests[0],
            requests,
          };
        })
      );

      return NextResponse.json({
        groups: groupsWithDetails,
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit),
        },
      });
    } else {
      // Return flat list of all requests
      const [requests, total] = await Promise.all([
        prisma.codeRequest.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            resolvedCode: {
              select: {
                id: true,
                code_id: true,
                name: true,
              },
            },
          },
          orderBy: { created_at: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.codeRequest.count({ where }),
      ]);

      return NextResponse.json({
        requests,
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit),
        },
      });
    }
  } catch (error) {
    console.error("Error listing code requests:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to list code requests" },
      { status: 500 }
    );
  }
}
