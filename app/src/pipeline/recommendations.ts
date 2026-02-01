import { PrismaClient, FindingCategory, FindingStatus } from "@prisma/client";
import { getVisionModel, parseJsonFromResponse } from "../lib/gemini";
import { AnalysisResult } from "./matrix-analysis";
import { CrossValidationResult } from "./cross-validation";

/**
 * Recommendations + Completion Pipeline (US-038)
 *
 * Responsible for:
 * 1. Sending non-compliant findings to Gemini for coordinated recommendations
 * 2. Assigning category and sort_order (Critical first, then by category)
 * 3. Saving all Findings to the database
 * 4. Setting analysis status to COMPLETED with completed_at timestamp
 */

// Category display order for sorting
const CATEGORY_ORDER: Record<FindingCategory, number> = {
  STRUCTURAL: 1,
  FIRE_SAFETY: 2,
  EGRESS: 3,
  ACCESSIBILITY: 4,
  ENERGY: 5,
  GENERAL_BUILDING: 6,
  SITE: 7,
  PLUMBING: 8,
  ELECTRICAL: 9,
  MECHANICAL: 10,
};

// Status priority for sorting (Critical first)
const STATUS_ORDER: Record<FindingStatus, number> = {
  CRITICAL: 1,
  WARNING: 2,
  NOT_ASSESSED: 3,
  COMPLIANT: 4,
};

interface CoordinatedRecommendation {
  codeRef: string;
  recommendation: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  relatedFindings?: string[];
}

interface RecommendationsResponse {
  recommendations: CoordinatedRecommendation[];
  summary: string;
}

export interface RecommendationsResult {
  totalFindings: number;
  recommendationsGenerated: number;
}

/**
 * Get non-compliant findings (CRITICAL and WARNING)
 */
function getNonCompliantFindings(results: AnalysisResult[]): AnalysisResult[] {
  return results.filter(
    (r) => r.status === "CRITICAL" || r.status === "WARNING"
  );
}

/**
 * Build context for coordinated recommendations
 */
function buildRecommendationsPrompt(findings: AnalysisResult[]): string {
  const findingsSummary = findings.map((f, i) => {
    return `${i + 1}. [${f.status}] ${f.codeRef} - ${f.category}
   Requirement: ${f.requiredValue}
   Found: ${f.proposedValue || "Not specified"}
   Issue: ${f.analysisNotes}
   Current Recommendation: ${f.recommendation || "None"}`;
  }).join("\n\n");

  return `You are an expert building code compliance consultant. Review the following non-compliant findings from a building plan analysis and provide coordinated, actionable recommendations.

## Non-Compliant Findings:
${findingsSummary}

## Your Task:
1. Review all findings holistically
2. Identify any related issues that should be addressed together
3. Prioritize recommendations based on safety impact and complexity
4. Provide specific, actionable recommendations for each finding
5. Where possible, suggest combined solutions that address multiple issues

## Response Format (JSON only):
{
  "recommendations": [
    {
      "codeRef": "code reference (e.g., R302.1)",
      "recommendation": "Specific, actionable recommendation with measurements/specifications where applicable",
      "priority": "HIGH" | "MEDIUM" | "LOW",
      "relatedFindings": ["array of related codeRefs that could be addressed together, if any"]
    }
  ],
  "summary": "Brief overall summary of key actions needed"
}

Priority definitions:
- HIGH: Life safety issues, critical structural requirements, fire safety - must address before approval
- MEDIUM: Code compliance issues that affect habitability or function - should address before approval
- LOW: Minor deviations, best practice improvements - may be addressed after approval with conditions

Respond ONLY with valid JSON, no additional text.`;
}

/**
 * Generate coordinated recommendations using Gemini
 */
async function generateCoordinatedRecommendations(
  findings: AnalysisResult[]
): Promise<Map<string, string>> {
  const recommendationsMap = new Map<string, string>();

  if (findings.length === 0) {
    return recommendationsMap;
  }

  const model = getVisionModel();
  const prompt = buildRecommendationsPrompt(findings);

  try {
    const result = await model.generateContent([{ text: prompt }]);
    const responseText = result.response.text();
    const response = parseJsonFromResponse<RecommendationsResponse>(responseText);

    // Map recommendations back to code references
    for (const rec of response.recommendations) {
      const codeRef = rec.codeRef;
      const enhancedRecommendation = rec.relatedFindings && rec.relatedFindings.length > 0
        ? `${rec.recommendation}\n\n[Priority: ${rec.priority}] [Related: ${rec.relatedFindings.join(", ")}]`
        : `${rec.recommendation}\n\n[Priority: ${rec.priority}]`;

      recommendationsMap.set(codeRef, enhancedRecommendation);
    }

    console.log(`[Recommendations] Generated ${response.recommendations.length} coordinated recommendations`);
    console.log(`[Recommendations] Summary: ${response.summary}`);

  } catch (error) {
    console.error(`[Recommendations] Failed to generate coordinated recommendations:`, error);
    // Fall back to using existing recommendations from analysis
    for (const finding of findings) {
      if (finding.recommendation) {
        recommendationsMap.set(finding.codeRef, finding.recommendation);
      }
    }
  }

  return recommendationsMap;
}

/**
 * Apply coordinated recommendations to results
 */
function applyRecommendations(
  results: AnalysisResult[],
  recommendationsMap: Map<string, string>
): AnalysisResult[] {
  return results.map((result) => {
    const coordinatedRec = recommendationsMap.get(result.codeRef);
    if (coordinatedRec && (result.status === "CRITICAL" || result.status === "WARNING")) {
      return {
        ...result,
        recommendation: coordinatedRec,
      };
    }
    return result;
  });
}

/**
 * Sort findings: Critical first, then by category, then by code reference
 */
function sortFindings(results: AnalysisResult[]): AnalysisResult[] {
  return [...results].sort((a, b) => {
    // First sort by status (Critical first)
    const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (statusDiff !== 0) return statusDiff;

    // Then by category
    const categoryDiff = CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category];
    if (categoryDiff !== 0) return categoryDiff;

    // Finally by code reference alphabetically
    return a.codeRef.localeCompare(b.codeRef);
  });
}

/**
 * Save findings to the database
 */
async function saveFindings(
  prisma: PrismaClient,
  analysisId: string,
  results: AnalysisResult[]
): Promise<void> {
  // Sort findings for proper display order
  const sortedResults = sortFindings(results);

  // Create finding records
  const findingsData = sortedResults.map((result, index) => ({
    analysis_id: analysisId,
    code_reference: result.codeRef,
    category: result.category,
    status: result.status,
    confidence: result.confidence,
    description: result.description,
    required_value: result.requiredValue,
    proposed_value: result.proposedValue,
    page_number: result.pageNumber,
    location: result.location,
    analysis_notes: result.analysisNotes,
    recommendation: result.recommendation,
    raw_extraction: result.rawExtraction as object,
    sort_order: index,
  }));

  // Batch insert all findings
  await prisma.finding.createMany({
    data: findingsData,
  });

  console.log(`[Recommendations] Saved ${findingsData.length} findings to database`);
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
      status: "GENERATING",
    },
  });
}

/**
 * Mark analysis as completed
 */
async function completeAnalysis(
  prisma: PrismaClient,
  analysisId: string
): Promise<void> {
  await prisma.analysis.update({
    where: { id: analysisId },
    data: {
      status: "COMPLETED",
      current_stage: "Analysis complete",
      completed_at: new Date(),
    },
  });
}

/**
 * Main recommendations and completion function
 */
export async function runRecommendationsAndCompletion(
  prisma: PrismaClient,
  analysisId: string,
  validationResult: CrossValidationResult
): Promise<RecommendationsResult> {
  const { validatedResults } = validationResult;

  console.log(`[Recommendations] Starting recommendations generation for analysis ${analysisId}`);
  console.log(`[Recommendations] Processing ${validatedResults.length} validated results`);

  // Update status to GENERATING
  await updateStage(prisma, analysisId, "Generating recommendations");

  // Step 1: Get non-compliant findings for coordinated recommendations
  const nonCompliantFindings = getNonCompliantFindings(validatedResults);
  console.log(`[Recommendations] Found ${nonCompliantFindings.length} non-compliant findings`);

  // Step 2: Generate coordinated recommendations
  let recommendationsGenerated = 0;
  let resultsWithRecommendations = validatedResults;

  if (nonCompliantFindings.length > 0) {
    await updateStage(prisma, analysisId, `Generating recommendations for ${nonCompliantFindings.length} findings`);

    const recommendationsMap = await generateCoordinatedRecommendations(nonCompliantFindings);
    recommendationsGenerated = recommendationsMap.size;

    // Apply recommendations to results
    resultsWithRecommendations = applyRecommendations(validatedResults, recommendationsMap);
  }

  // Step 3: Save all findings to database
  await updateStage(prisma, analysisId, "Saving findings");
  await saveFindings(prisma, analysisId, resultsWithRecommendations);

  // Step 4: Mark analysis as completed
  await completeAnalysis(prisma, analysisId);

  console.log(`[Recommendations] Recommendations and completion finished`);
  console.log(`[Recommendations] Total findings: ${validatedResults.length}, Recommendations generated: ${recommendationsGenerated}`);

  return {
    totalFindings: validatedResults.length,
    recommendationsGenerated,
  };
}
