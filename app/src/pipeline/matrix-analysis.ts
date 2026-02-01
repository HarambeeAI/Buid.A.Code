import { PrismaClient, FindingCategory, Confidence, FindingStatus } from "@prisma/client";
import { fetchFromBucket } from "../lib/storage";
import { getVisionModel, bufferToImagePart, parseJsonFromResponse } from "../lib/gemini";
import { ClassifiedPage, PageType } from "./page-classification";

/**
 * Matrix Analysis Pipeline (US-036)
 *
 * Responsible for:
 * 1. Fetching PUBLISHED CodeRequirements for selected codes
 * 2. Building a code x page matrix (requirement matched with applicable pages)
 * 3. Constructing vision prompts from requirement fields
 * 4. Parallel Gemini calls (max 10 concurrent) for each requirement x page pair
 * 5. Progressive total_checks update during processing
 */

// Types for code requirements
interface CodeRequirement {
  id: string;
  code_ref: string;
  title: string;
  category: FindingCategory;
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
  building_code: {
    code_id: string;
    name: string;
  };
}

// Types for matrix analysis
interface MatrixPair {
  requirement: CodeRequirement;
  page: ClassifiedPage;
}

interface GeminiAnalysisResponse {
  measurements_found: Array<{
    name: string;
    value: string | number;
    unit: string;
    location?: string;
  }>;
  status: "COMPLIANT" | "WARNING" | "CRITICAL" | "NOT_ASSESSED";
  confidence: "HIGH" | "MEDIUM" | "LOW";
  reasoning: string;
  required_value: string;
  proposed_value: string | null;
  recommendation: string | null;
}

export interface AnalysisResult {
  requirementId: string;
  codeRef: string;
  codeId: string;
  category: FindingCategory;
  pageNumber: number;
  status: FindingStatus;
  confidence: Confidence;
  description: string;
  requiredValue: string;
  proposedValue: string | null;
  location: string | null;
  analysisNotes: string;
  recommendation: string | null;
  rawExtraction: GeminiAnalysisResponse;
}

export interface MatrixAnalysisResult {
  results: AnalysisResult[];
  totalChecks: number;
  totalPairs: number;
}

/**
 * Fetch PUBLISHED requirements for selected building codes
 */
async function fetchRequirements(
  prisma: PrismaClient,
  selectedCodes: string[]
): Promise<CodeRequirement[]> {
  const requirements = await prisma.codeRequirement.findMany({
    where: {
      status: "PUBLISHED",
      building_code: {
        code_id: { in: selectedCodes },
      },
    },
    include: {
      building_code: {
        select: {
          code_id: true,
          name: true,
        },
      },
    },
  });

  return requirements.map((req) => ({
    id: req.id,
    code_ref: req.code_ref,
    title: req.title,
    category: req.category,
    full_text: req.full_text,
    check_type: req.check_type,
    thresholds: req.thresholds as Record<string, unknown>,
    applies_to_drawing_types: req.applies_to_drawing_types as string[],
    applies_to_building_types: req.applies_to_building_types as string[],
    applies_to_spaces: req.applies_to_spaces as string[],
    exceptions: req.exceptions as string[],
    extraction_guidance: req.extraction_guidance,
    evaluation_guidance: req.evaluation_guidance,
    source_page: req.source_page,
    building_code: req.building_code,
  }));
}

/**
 * Build the code x page matrix by matching requirements to applicable pages
 */
function buildMatrix(
  requirements: CodeRequirement[],
  pages: ClassifiedPage[]
): MatrixPair[] {
  const pairs: MatrixPair[] = [];

  for (const requirement of requirements) {
    const applicableTypes = requirement.applies_to_drawing_types;

    // Find pages that match the requirement's applicable drawing types
    const matchingPages = pages.filter((page) => {
      // "all" means apply to all page types
      if (applicableTypes.includes("all")) return true;
      // Check if page type matches any of the applicable types
      return applicableTypes.includes(page.pageType);
    });

    // Create a pair for each matching page
    for (const page of matchingPages) {
      pairs.push({ requirement, page });
    }
  }

  return pairs;
}

/**
 * Construct the analysis prompt for a requirement x page pair
 */
function constructPrompt(requirement: CodeRequirement): string {
  const thresholdsText = Object.keys(requirement.thresholds).length > 0
    ? `\nThresholds: ${JSON.stringify(requirement.thresholds)}`
    : "";

  const exceptionsText = requirement.exceptions.length > 0
    ? `\nExceptions to consider: ${requirement.exceptions.join("; ")}`
    : "";

  return `You are an expert building code compliance analyst. Analyze this architectural drawing to check compliance with the following requirement.

## Code Reference: ${requirement.code_ref}
## Code: ${requirement.building_code.code_id} - ${requirement.building_code.name}
## Title: ${requirement.title}
## Category: ${requirement.category}

## Requirement Text:
${requirement.full_text}
${thresholdsText}
${exceptionsText}

## What to Extract:
${requirement.extraction_guidance}

## How to Evaluate:
${requirement.evaluation_guidance}

## Your Task:
1. Examine the drawing carefully for elements related to this requirement
2. Extract any relevant measurements, dimensions, or features
3. Compare against the requirement thresholds or criteria
4. Determine compliance status

## Response Format (JSON only):
{
  "measurements_found": [
    {"name": "measurement name", "value": "measured value", "unit": "unit", "location": "where found on drawing"}
  ],
  "status": "COMPLIANT" | "WARNING" | "CRITICAL" | "NOT_ASSESSED",
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "reasoning": "Detailed explanation of your analysis and findings",
  "required_value": "What the code requires (from the requirement text)",
  "proposed_value": "What was found in the drawing, or null if not visible",
  "recommendation": "Specific action to achieve compliance, or null if compliant"
}

Status definitions:
- COMPLIANT: Meets or exceeds the requirement
- WARNING: Minor deviation or needs verification
- CRITICAL: Does not meet the requirement
- NOT_ASSESSED: Cannot determine from this drawing (not visible, wrong page type, etc.)

Confidence definitions:
- HIGH: Measurements clearly visible and unambiguous
- MEDIUM: Some uncertainty in readings or partial visibility
- LOW: Significant uncertainty, manual verification recommended

Respond ONLY with valid JSON, no additional text.`;
}

/**
 * Analyze a single requirement x page pair
 */
async function analyzePair(
  pair: MatrixPair
): Promise<AnalysisResult | null> {
  const { requirement, page } = pair;
  const model = getVisionModel();

  try {
    // Fetch page image from bucket
    const imageBuffer = await fetchFromBucket(page.imageKey);
    const imagePart = bufferToImagePart(imageBuffer, "image/png");

    // Construct the analysis prompt
    const prompt = constructPrompt(requirement);

    // Call Gemini for analysis
    const result = await model.generateContent([
      { text: prompt },
      imagePart,
    ]);

    const responseText = result.response.text();
    const analysis = parseJsonFromResponse<GeminiAnalysisResponse>(responseText);

    // Validate and map status
    const validStatuses: FindingStatus[] = ["COMPLIANT", "WARNING", "CRITICAL", "NOT_ASSESSED"];
    const status: FindingStatus = validStatuses.includes(analysis.status as FindingStatus)
      ? (analysis.status as FindingStatus)
      : "NOT_ASSESSED";

    // Validate and map confidence
    const validConfidences: Confidence[] = ["HIGH", "MEDIUM", "LOW"];
    const confidence: Confidence = validConfidences.includes(analysis.confidence as Confidence)
      ? (analysis.confidence as Confidence)
      : "LOW";

    // Extract location from measurements if available
    const location = analysis.measurements_found?.[0]?.location || null;

    return {
      requirementId: requirement.id,
      codeRef: requirement.code_ref,
      codeId: requirement.building_code.code_id,
      category: requirement.category,
      pageNumber: page.pageNumber,
      status,
      confidence,
      description: requirement.full_text,
      requiredValue: analysis.required_value || requirement.title,
      proposedValue: analysis.proposed_value,
      location,
      analysisNotes: analysis.reasoning || "Analysis completed",
      recommendation: analysis.recommendation,
      rawExtraction: analysis,
    };
  } catch (error) {
    console.error(`[MatrixAnalysis] Error analyzing ${requirement.code_ref} on page ${page.pageNumber}:`, error);

    // Return a NOT_ASSESSED result on error
    return {
      requirementId: requirement.id,
      codeRef: requirement.code_ref,
      codeId: requirement.building_code.code_id,
      category: requirement.category,
      pageNumber: page.pageNumber,
      status: "NOT_ASSESSED",
      confidence: "LOW",
      description: requirement.full_text,
      requiredValue: requirement.title,
      proposedValue: null,
      location: null,
      analysisNotes: `Analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      recommendation: "Manual review required due to analysis error",
      rawExtraction: {
        measurements_found: [],
        status: "NOT_ASSESSED",
        confidence: "LOW",
        reasoning: "Analysis could not be completed due to an error",
        required_value: requirement.title,
        proposed_value: null,
        recommendation: "Manual review required",
      },
    };
  }
}

/**
 * Process pairs in parallel batches
 */
async function processBatches(
  prisma: PrismaClient,
  analysisId: string,
  pairs: MatrixPair[],
  batchSize: number = 10
): Promise<AnalysisResult[]> {
  const results: AnalysisResult[] = [];
  let processedCount = 0;

  for (let i = 0; i < pairs.length; i += batchSize) {
    const batch = pairs.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(pairs.length / batchSize);

    // Update progress
    const progress = `Analysing batch ${batchNumber} of ${totalBatches} (${processedCount}/${pairs.length} checks)`;
    await updateStage(prisma, analysisId, progress);
    console.log(`[MatrixAnalysis] ${progress}`);

    // Process batch in parallel
    const batchPromises = batch.map((pair) => analyzePair(pair));
    const batchResults = await Promise.all(batchPromises);

    // Collect non-null results
    for (const result of batchResults) {
      if (result) {
        results.push(result);
        processedCount++;
      }
    }

    // Progressive update of total_checks
    await prisma.analysis.update({
      where: { id: analysisId },
      data: { total_checks: processedCount },
    });
  }

  return results;
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
    data: {
      current_stage: stage,
      status: "ANALYSING",
    },
  });
}

/**
 * Main matrix analysis function
 */
export async function runMatrixAnalysis(
  prisma: PrismaClient,
  analysisId: string,
  selectedCodes: string[],
  classifiedPages: ClassifiedPage[]
): Promise<MatrixAnalysisResult> {
  console.log(`[MatrixAnalysis] Starting matrix analysis for analysis ${analysisId}`);
  console.log(`[MatrixAnalysis] Selected codes: ${selectedCodes.join(", ")}`);
  console.log(`[MatrixAnalysis] Total pages: ${classifiedPages.length}`);

  // Update status to ANALYSING
  await updateStage(prisma, analysisId, "Fetching code requirements");

  // Step 1: Fetch PUBLISHED requirements for selected codes
  const requirements = await fetchRequirements(prisma, selectedCodes);
  console.log(`[MatrixAnalysis] Found ${requirements.length} published requirements`);

  if (requirements.length === 0) {
    console.log(`[MatrixAnalysis] No requirements found for selected codes`);
    return {
      results: [],
      totalChecks: 0,
      totalPairs: 0,
    };
  }

  // Step 2: Build the code x page matrix
  await updateStage(prisma, analysisId, "Building analysis matrix");
  const pairs = buildMatrix(requirements, classifiedPages);
  console.log(`[MatrixAnalysis] Built matrix with ${pairs.length} requirement x page pairs`);

  if (pairs.length === 0) {
    console.log(`[MatrixAnalysis] No applicable pairs found (no matching page types)`);
    return {
      results: [],
      totalChecks: 0,
      totalPairs: 0,
    };
  }

  // Log matrix summary
  const pairsByRequirement = pairs.reduce((acc, pair) => {
    const ref = pair.requirement.code_ref;
    acc[ref] = (acc[ref] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  console.log(`[MatrixAnalysis] Matrix breakdown:`, pairsByRequirement);

  // Step 3 & 4: Process pairs in parallel batches (max 10 concurrent)
  const results = await processBatches(prisma, analysisId, pairs, 10);
  console.log(`[MatrixAnalysis] Completed ${results.length} checks`);

  // Log results summary
  const statusCounts = results.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  console.log(`[MatrixAnalysis] Results summary:`, statusCounts);

  return {
    results,
    totalChecks: results.length,
    totalPairs: pairs.length,
  };
}
