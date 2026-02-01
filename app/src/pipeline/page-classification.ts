import { PrismaClient } from "@prisma/client";
import { fetchFromBucket } from "../lib/storage";
import { getVisionModel, bufferToImagePart, parseJsonFromResponse } from "../lib/gemini";
import { NormalisedPage } from "./document-normalisation";

/**
 * Page Classification Pipeline (US-035)
 *
 * Responsible for:
 * 1. Sending each normalised page image to Gemini for classification
 * 2. Determining page type (floor_plan, elevation, section, etc.)
 * 3. Extracting description and detected scale
 * 4. Updating current_stage during processing
 */

export type PageType =
  | "floor_plan"
  | "elevation"
  | "section"
  | "site_plan"
  | "detail"
  | "schedule"
  | "title_block"
  | "other";

export interface ClassifiedPage {
  pageNumber: number;
  imageKey: string;
  width: number;
  height: number;
  pageType: PageType;
  description: string;
  scaleDetected: string | null;
}

export interface ClassificationResult {
  pages: ClassifiedPage[];
  totalPages: number;
}

interface GeminiClassificationResponse {
  page_type: PageType;
  description: string;
  scale_detected: string | null;
}

const CLASSIFICATION_PROMPT = `You are an expert architectural drawing analyst. Analyze this building plan page image and classify it.

Return a JSON object with the following fields:
- page_type: one of "floor_plan", "elevation", "section", "site_plan", "detail", "schedule", "title_block", "other"
- description: a brief 1-2 sentence description of what this page shows
- scale_detected: the scale if visible on the drawing (e.g., "1:100", "1/4" = 1'-0"", "1:50"), or null if not visible

Page type definitions:
- floor_plan: Horizontal cut view showing room layouts, walls, doors, windows from above
- elevation: Vertical view of building exterior or interior walls showing heights
- section: Cut-through view showing internal structure and heights
- site_plan: Bird's eye view showing the building footprint on the property with boundaries, setbacks
- detail: Enlarged view of specific construction details (connections, assemblies)
- schedule: Tables listing doors, windows, finishes, or other specifications
- title_block: Sheet containing project information, revision history, drawing index
- other: Pages that don't fit other categories (notes, legends, cover sheets)

Respond ONLY with a valid JSON object, no additional text.

Example response:
{"page_type": "floor_plan", "description": "Ground floor plan showing living areas, kitchen, and two bedrooms with dimensions marked.", "scale_detected": "1:100"}`;

/**
 * Main classification function
 * Classifies each page using Gemini vision
 */
export async function classifyPages(
  prisma: PrismaClient,
  analysisId: string,
  normalisedPages: NormalisedPage[]
): Promise<ClassificationResult> {
  console.log(`[Classification] Starting classification for analysis ${analysisId}`);
  console.log(`[Classification] Total pages to classify: ${normalisedPages.length}`);

  const classifiedPages: ClassifiedPage[] = [];
  const model = getVisionModel();

  for (let i = 0; i < normalisedPages.length; i++) {
    const page = normalisedPages[i];
    const progress = `Classifying page ${i + 1} of ${normalisedPages.length}`;

    await updateStage(prisma, analysisId, progress);
    console.log(`[Classification] ${progress}`);

    try {
      // Fetch page image from bucket
      const imageBuffer = await fetchFromBucket(page.imageKey);

      // Create image part for Gemini
      const imagePart = bufferToImagePart(imageBuffer, "image/png");

      // Call Gemini for classification
      const result = await model.generateContent([
        { text: CLASSIFICATION_PROMPT },
        imagePart,
      ]);

      const responseText = result.response.text();
      console.log(`[Classification] Page ${page.pageNumber} response: ${responseText.substring(0, 100)}...`);

      // Parse the JSON response
      const classification = parseJsonFromResponse<GeminiClassificationResponse>(responseText);

      // Validate page_type
      const validPageTypes: PageType[] = [
        "floor_plan",
        "elevation",
        "section",
        "site_plan",
        "detail",
        "schedule",
        "title_block",
        "other",
      ];

      const pageType: PageType = validPageTypes.includes(classification.page_type as PageType)
        ? (classification.page_type as PageType)
        : "other";

      classifiedPages.push({
        pageNumber: page.pageNumber,
        imageKey: page.imageKey,
        width: page.width,
        height: page.height,
        pageType,
        description: classification.description || "No description available",
        scaleDetected: classification.scale_detected || null,
      });

      console.log(`[Classification] Page ${page.pageNumber}: ${pageType} - ${classification.description?.substring(0, 50)}...`);
    } catch (error) {
      console.error(`[Classification] Error classifying page ${page.pageNumber}:`, error);

      // Default to "other" if classification fails
      classifiedPages.push({
        pageNumber: page.pageNumber,
        imageKey: page.imageKey,
        width: page.width,
        height: page.height,
        pageType: "other",
        description: "Classification failed - manual review recommended",
        scaleDetected: null,
      });
    }
  }

  console.log(`[Classification] Completed: ${classifiedPages.length} pages classified`);

  // Log classification summary
  const typeCounts = classifiedPages.reduce(
    (acc, page) => {
      acc[page.pageType] = (acc[page.pageType] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  console.log(`[Classification] Summary:`, typeCounts);

  return {
    pages: classifiedPages,
    totalPages: classifiedPages.length,
  };
}

/**
 * Update analysis current_stage
 */
async function updateStage(
  prisma: PrismaClient,
  analysisId: string,
  stage: string
): Promise<void> {
  await prisma.analysis.update({
    where: { id: analysisId },
    data: { current_stage: stage },
  });
}
