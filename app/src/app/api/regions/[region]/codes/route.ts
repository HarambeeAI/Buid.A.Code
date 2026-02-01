import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Region, BuildingCodeStatus } from "@prisma/client";

// Valid regions
const VALID_REGIONS = ["AU", "UK", "US"] as const;

/**
 * GET /api/regions/:region/codes
 * Returns ACTIVE building codes for a specific region with requirement_count.
 * Public endpoint - no authentication required.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ region: string }> }
) {
  try {
    const { region } = await context.params;
    const regionUpper = region.toUpperCase();

    // Validate region
    if (!VALID_REGIONS.includes(regionUpper as (typeof VALID_REGIONS)[number])) {
      return NextResponse.json(
        { error: "Not Found", message: `Unknown region: ${region}` },
        { status: 404 }
      );
    }

    // Fetch ACTIVE codes for the region with requirement count
    const codes = await prisma.buildingCode.findMany({
      where: {
        region: regionUpper as Region,
        status: BuildingCodeStatus.ACTIVE,
      },
      select: {
        id: true,
        code_id: true,
        name: true,
        description: true,
        version: true,
        published_at: true,
        _count: {
          select: {
            requirements: {
              where: {
                status: "PUBLISHED",
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    // Transform to include requirement_count at top level
    const transformedCodes = codes.map((code) => ({
      id: code.id,
      code_id: code.code_id,
      name: code.name,
      description: code.description,
      version: code.version,
      published_at: code.published_at,
      requirement_count: code._count.requirements,
    }));

    return NextResponse.json({
      region: regionUpper,
      codes: transformedCodes,
    });
  } catch (error) {
    console.error("Error fetching codes for region:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to fetch codes" },
      { status: 500 }
    );
  }
}
