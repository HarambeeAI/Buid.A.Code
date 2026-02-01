import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fetchFromBucket } from "@/lib/storage";
import { getVisionModel, bufferToImagePart, parseJsonFromResponse } from "@/lib/gemini";
import { FindingCategory, CheckType, Prisma } from "@prisma/client";

const UuidSchema = z.string().uuid();

// Type for extracted requirement from Gemini
interface ExtractedRequirement {
  code_ref: string;
  title: string;
  category: string;
  full_text: string;
  check_type: string;
  thresholds: Record<string, unknown>;
  applies_to_drawing_types: string[];
  applies_to_building_types: string[];
  applies_to_spaces: string[];
  exceptions: string[];
  extraction_guidance: string;
  evaluation_guidance: string;
  source_page: number | null;
}

// Map category strings to enum values
const CATEGORY_MAP: Record<string, FindingCategory> = {
  structural: "STRUCTURAL",
  fire_safety: "FIRE_SAFETY",
  egress: "EGRESS",
  accessibility: "ACCESSIBILITY",
  energy: "ENERGY",
  general_building: "GENERAL_BUILDING",
  site: "SITE",
  plumbing: "PLUMBING",
  electrical: "ELECTRICAL",
  mechanical: "MECHANICAL",
};

// Map check type strings to enum values
const CHECK_TYPE_MAP: Record<string, CheckType> = {
  measurement_threshold: "MEASUREMENT_THRESHOLD",
  presence_check: "PRESENCE_CHECK",
  ratio_check: "RATIO_CHECK",
  boolean_check: "BOOLEAN_CHECK",
};

/**
 * POST /api/admin/codes/:id/extract
 * Extract requirements from the uploaded building code PDF using Gemini AI.
 * Admin only (protected by middleware).
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const idValidation = UuidSchema.safeParse(id);
    if (!idValidation.success) {
      return NextResponse.json(
        { error: "Bad Request", message: "Invalid code ID" },
        { status: 400 }
      );
    }

    // Get the building code with source document URL
    const code = await prisma.buildingCode.findUnique({
      where: { id },
      select: {
        id: true,
        code_id: true,
        name: true,
        region: true,
        source_document_url: true,
        status: true,
      },
    });

    if (!code) {
      return NextResponse.json(
        { error: "Not Found", message: "Building code not found" },
        { status: 404 }
      );
    }

    if (!code.source_document_url) {
      return NextResponse.json(
        { error: "Bad Request", message: "No source document uploaded. Please upload a PDF first." },
        { status: 400 }
      );
    }

    // Extract file key from URL
    const urlParts = new URL(code.source_document_url);
    const fileKey = urlParts.pathname.split("/").slice(2).join("/"); // Remove bucket prefix

    // Fetch the PDF from storage
    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await fetchFromBucket(fileKey);
    } catch (fetchError) {
      console.error("Error fetching PDF:", fetchError);
      return NextResponse.json(
        { error: "Bad Request", message: "Failed to fetch source document. It may have been deleted." },
        { status: 400 }
      );
    }

    // Convert PDF to images using pdf-to-img
    const { pdf } = await import("pdf-to-img");
    const pdfPages: Buffer[] = [];

    // Extract pages from PDF
    const pdfDocument = await pdf(pdfBuffer, { scale: 2.0 }); // Lower scale for extraction
    for await (const page of pdfDocument) {
      pdfPages.push(Buffer.from(page));
    }

    if (pdfPages.length === 0) {
      return NextResponse.json(
        { error: "Bad Request", message: "Could not extract pages from PDF" },
        { status: 400 }
      );
    }

    // Process pages in batches to extract requirements
    const visionModel = getVisionModel();
    const allRequirements: ExtractedRequirement[] = [];
    const BATCH_SIZE = 5; // Process 5 pages at a time

    for (let i = 0; i < pdfPages.length; i += BATCH_SIZE) {
      const batch = pdfPages.slice(i, i + BATCH_SIZE);
      const startPage = i + 1;

      // Create image parts for the batch
      const imageParts = batch.map((page) => bufferToImagePart(page, "image/png"));

      const prompt = `You are extracting building code requirements from a regulatory document.

Analyze the following ${batch.length} page(s) (pages ${startPage} to ${startPage + batch.length - 1}) of the "${code.name}" (${code.code_id}) building code from ${code.region}.

For each distinct, checkable requirement you find, extract:
1. code_ref: The official code reference number (e.g., "R302.1", "R311.7.5")
2. title: A short descriptive title
3. category: One of: structural, fire_safety, egress, accessibility, energy, general_building, site, plumbing, electrical, mechanical
4. full_text: The complete requirement text
5. check_type: One of: measurement_threshold (numeric values), presence_check (must exist), ratio_check (proportions), boolean_check (yes/no)
6. thresholds: JSON object with threshold values (e.g., {"min": 36, "unit": "inches"})
7. applies_to_drawing_types: Array of drawing types this applies to: ["floor_plan", "elevation", "section", "site_plan", "detail", "schedule", "all"]
8. applies_to_building_types: Array of building types: ["residential", "commercial", "industrial", "mixed_use", "all"]
9. applies_to_spaces: Array of specific spaces: ["bedroom", "bathroom", "kitchen", "hallway", "stairway", "all"]
10. exceptions: Array of exception conditions
11. extraction_guidance: Instructions for AI on how to extract measurements from drawings
12. evaluation_guidance: Instructions for AI on how to evaluate compliance
13. source_page: The page number where this requirement appears (${startPage} to ${startPage + batch.length - 1})

Return a JSON array of requirements. Only include checkable requirements (things that can be verified against architectural drawings). Skip procedural text, definitions, or commentary.

Example output:
[
  {
    "code_ref": "R302.1",
    "title": "Exterior Wall Fire-Resistance Rating",
    "category": "fire_safety",
    "full_text": "Exterior walls with a fire separation distance of less than 3 feet shall have not less than a 1-hour fire-resistance rating...",
    "check_type": "measurement_threshold",
    "thresholds": {"min_distance": 3, "unit": "feet", "required_rating": "1-hour"},
    "applies_to_drawing_types": ["floor_plan", "site_plan", "elevation"],
    "applies_to_building_types": ["residential"],
    "applies_to_spaces": ["all"],
    "exceptions": ["Detached accessory structures"],
    "extraction_guidance": "Measure the distance from exterior walls to property lines on site plans. Look for fire-resistance ratings in wall assembly details.",
    "evaluation_guidance": "If distance to property line < 3ft, wall must show 1-hour fire rating. Check elevation views for opening protectives.",
    "source_page": ${startPage}
  }
]

Return only the JSON array, no other text.`;

      try {
        const result = await visionModel.generateContent([
          prompt,
          ...imageParts,
        ]);

        const responseText = result.response.text();
        const requirements = parseJsonFromResponse<ExtractedRequirement[]>(responseText);

        if (Array.isArray(requirements)) {
          allRequirements.push(...requirements);
        }
      } catch (extractError) {
        console.error(`Error extracting from pages ${startPage}-${startPage + batch.length - 1}:`, extractError);
        // Continue with next batch
      }
    }

    if (allRequirements.length === 0) {
      return NextResponse.json(
        { error: "Bad Request", message: "No requirements could be extracted from the document" },
        { status: 400 }
      );
    }

    // Save extracted requirements as DRAFT
    const createdRequirements = await Promise.all(
      allRequirements.map(async (req) => {
        // Normalize category
        const categoryKey = req.category?.toLowerCase().replace(/\s+/g, "_") || "general_building";
        const category = CATEGORY_MAP[categoryKey] || "GENERAL_BUILDING";

        // Normalize check type
        const checkTypeKey = req.check_type?.toLowerCase().replace(/\s+/g, "_") || "presence_check";
        const checkType = CHECK_TYPE_MAP[checkTypeKey] || "PRESENCE_CHECK";

        return prisma.codeRequirement.create({
          data: {
            building_code_id: id,
            code_ref: req.code_ref || "UNKNOWN",
            title: req.title || "Untitled Requirement",
            category,
            full_text: req.full_text || "",
            check_type: checkType,
            thresholds: (req.thresholds || {}) as Prisma.InputJsonValue,
            applies_to_drawing_types: (req.applies_to_drawing_types || ["all"]) as Prisma.InputJsonValue,
            applies_to_building_types: (req.applies_to_building_types || ["all"]) as Prisma.InputJsonValue,
            applies_to_spaces: (req.applies_to_spaces || ["all"]) as Prisma.InputJsonValue,
            exceptions: (req.exceptions || []) as Prisma.InputJsonValue,
            extraction_guidance: req.extraction_guidance || "",
            evaluation_guidance: req.evaluation_guidance || "",
            source_page: req.source_page,
            status: "DRAFT",
          },
          select: {
            id: true,
            code_ref: true,
            title: true,
            category: true,
            status: true,
          },
        });
      })
    );

    return NextResponse.json({
      success: true,
      message: `${createdRequirements.length} requirements extracted`,
      count: createdRequirements.length,
      requirements: createdRequirements,
      pages_processed: pdfPages.length,
    });
  } catch (error) {
    console.error("Error extracting requirements:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to extract requirements" },
      { status: 500 }
    );
  }
}
