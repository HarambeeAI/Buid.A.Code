import { PrismaClient, FindingStatus, Confidence, OverallStatus } from "@prisma/client";
import { AnalysisResult } from "./matrix-analysis";

/**
 * Cross-Validation and Scoring Pipeline (US-037)
 *
 * Responsible for:
 * 1. Cross-page comparison: detecting conflicts when same requirement assessed on multiple pages
 * 2. Deduplication: keeping highest confidence result per requirement
 * 3. Score calculation: COMPLIANT / (COMPLIANT + WARNING + CRITICAL) × 100
 * 4. Overall status assignment: PASS (>= 90% and 0 critical), CONDITIONAL (>= 70% or has critical), FAIL (< 70%)
 * 5. Populating count fields (critical_count, warning_count, compliant_count, not_assessed_count)
 */

// Confidence priority for deduplication (HIGH > MEDIUM > LOW)
const CONFIDENCE_PRIORITY: Record<Confidence, number> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

// Status priority for conflict resolution (CRITICAL > WARNING > COMPLIANT > NOT_ASSESSED)
// When same confidence, prefer the more severe status
const STATUS_PRIORITY: Record<FindingStatus, number> = {
  CRITICAL: 4,
  WARNING: 3,
  COMPLIANT: 2,
  NOT_ASSESSED: 1,
};

export interface CrossValidationResult {
  validatedResults: AnalysisResult[];
  conflicts: ConflictInfo[];
  statusCounts: StatusCounts;
  complianceScore: number;
  overallStatus: OverallStatus;
}

export interface ConflictInfo {
  requirementId: string;
  codeRef: string;
  conflictingPages: number[];
  conflictingStatuses: FindingStatus[];
  resolution: string;
}

export interface StatusCounts {
  critical: number;
  warning: number;
  compliant: number;
  notAssessed: number;
  total: number;
}

/**
 * Group results by requirement ID for cross-page analysis
 */
function groupByRequirement(results: AnalysisResult[]): Map<string, AnalysisResult[]> {
  const grouped = new Map<string, AnalysisResult[]>();

  for (const result of results) {
    const existing = grouped.get(result.requirementId) || [];
    existing.push(result);
    grouped.set(result.requirementId, existing);
  }

  return grouped;
}

/**
 * Detect conflicts in results for the same requirement across multiple pages
 */
function detectConflicts(results: AnalysisResult[]): ConflictInfo | null {
  if (results.length <= 1) {
    return null; // No conflict possible with single result
  }

  // Get unique statuses (excluding NOT_ASSESSED as it doesn't conflict)
  const assessedResults = results.filter((r) => r.status !== "NOT_ASSESSED");
  if (assessedResults.length <= 1) {
    return null; // Not enough assessed results to conflict
  }

  const uniqueStatuses = new Set(assessedResults.map((r) => r.status));

  // If all assessed results have the same status, no conflict
  if (uniqueStatuses.size <= 1) {
    return null;
  }

  // Conflict detected: different statuses on different pages
  return {
    requirementId: results[0].requirementId,
    codeRef: results[0].codeRef,
    conflictingPages: assessedResults.map((r) => r.pageNumber),
    conflictingStatuses: assessedResults.map((r) => r.status),
    resolution: "Kept result with highest confidence (and most severe status for ties)",
  };
}

/**
 * Select the best result from multiple results for the same requirement
 *
 * Priority order:
 * 1. Highest confidence (HIGH > MEDIUM > LOW)
 * 2. If confidence is equal, prefer more severe status (CRITICAL > WARNING > COMPLIANT > NOT_ASSESSED)
 * 3. If both equal, prefer lower page number (earlier in document)
 */
function selectBestResult(results: AnalysisResult[]): AnalysisResult {
  if (results.length === 1) {
    return results[0];
  }

  return results.reduce((best, current) => {
    const bestConfidencePriority = CONFIDENCE_PRIORITY[best.confidence];
    const currentConfidencePriority = CONFIDENCE_PRIORITY[current.confidence];

    // Higher confidence wins
    if (currentConfidencePriority > bestConfidencePriority) {
      return current;
    }
    if (currentConfidencePriority < bestConfidencePriority) {
      return best;
    }

    // Same confidence: more severe status wins
    const bestStatusPriority = STATUS_PRIORITY[best.status];
    const currentStatusPriority = STATUS_PRIORITY[current.status];

    if (currentStatusPriority > bestStatusPriority) {
      return current;
    }
    if (currentStatusPriority < bestStatusPriority) {
      return best;
    }

    // Same confidence and status: earlier page number wins
    if (current.pageNumber < best.pageNumber) {
      return current;
    }

    return best;
  });
}

/**
 * Deduplicate results by keeping highest confidence per requirement
 */
function deduplicateResults(
  groupedResults: Map<string, AnalysisResult[]>
): {
  deduplicated: AnalysisResult[];
  conflicts: ConflictInfo[];
} {
  const deduplicated: AnalysisResult[] = [];
  const conflicts: ConflictInfo[] = [];

  for (const [, results] of groupedResults) {
    // Detect conflicts before deduplication
    const conflict = detectConflicts(results);
    if (conflict) {
      conflicts.push(conflict);
    }

    // Select the best result
    const bestResult = selectBestResult(results);
    deduplicated.push(bestResult);
  }

  return { deduplicated, conflicts };
}

/**
 * Calculate status counts from deduplicated results
 */
function calculateStatusCounts(results: AnalysisResult[]): StatusCounts {
  const counts: StatusCounts = {
    critical: 0,
    warning: 0,
    compliant: 0,
    notAssessed: 0,
    total: results.length,
  };

  for (const result of results) {
    switch (result.status) {
      case "CRITICAL":
        counts.critical++;
        break;
      case "WARNING":
        counts.warning++;
        break;
      case "COMPLIANT":
        counts.compliant++;
        break;
      case "NOT_ASSESSED":
        counts.notAssessed++;
        break;
    }
  }

  return counts;
}

/**
 * Calculate compliance score
 *
 * Formula: COMPLIANT / (COMPLIANT + WARNING + CRITICAL) × 100
 * NOT_ASSESSED excluded from calculation
 */
function calculateComplianceScore(counts: StatusCounts): number {
  const assessed = counts.compliant + counts.warning + counts.critical;

  if (assessed === 0) {
    // If nothing was assessed, score is 0 (or could be considered N/A)
    return 0;
  }

  const score = (counts.compliant / assessed) * 100;

  // Round to 1 decimal place
  return Math.round(score * 10) / 10;
}

/**
 * Determine overall status based on score and critical findings
 *
 * Rules:
 * - PASS: score >= 90% AND 0 critical findings
 * - FAIL: score < 70%
 * - CONDITIONAL: everything else (70% <= score < 90% OR has critical findings)
 */
function determineOverallStatus(
  score: number,
  criticalCount: number
): OverallStatus {
  // FAIL if score is below 70%
  if (score < 70) {
    return "FAIL";
  }

  // PASS only if score >= 90% AND no critical findings
  if (score >= 90 && criticalCount === 0) {
    return "PASS";
  }

  // Everything else is CONDITIONAL
  return "CONDITIONAL";
}

/**
 * Update analysis stage
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
      status: "VALIDATING",
    },
  });
}

/**
 * Main cross-validation and scoring function
 */
export async function runCrossValidation(
  prisma: PrismaClient,
  analysisId: string,
  results: AnalysisResult[]
): Promise<CrossValidationResult> {
  console.log(`[CrossValidation] Starting cross-validation for analysis ${analysisId}`);
  console.log(`[CrossValidation] Processing ${results.length} raw results`);

  // Update status to VALIDATING
  await updateStage(prisma, analysisId, "Starting cross-validation");

  // Step 1: Group results by requirement
  await updateStage(prisma, analysisId, "Grouping results by requirement");
  const groupedResults = groupByRequirement(results);
  console.log(`[CrossValidation] Found ${groupedResults.size} unique requirements`);

  // Step 2: Cross-page comparison and deduplication
  await updateStage(prisma, analysisId, "Performing cross-page validation");
  const { deduplicated, conflicts } = deduplicateResults(groupedResults);
  console.log(`[CrossValidation] Deduplicated to ${deduplicated.length} results`);

  if (conflicts.length > 0) {
    console.log(`[CrossValidation] Detected ${conflicts.length} conflicts:`);
    for (const conflict of conflicts) {
      console.log(
        `  - ${conflict.codeRef}: pages ${conflict.conflictingPages.join(", ")} ` +
        `had statuses ${conflict.conflictingStatuses.join(", ")}`
      );
    }
  }

  // Step 3: Calculate status counts
  await updateStage(prisma, analysisId, "Calculating compliance metrics");
  const statusCounts = calculateStatusCounts(deduplicated);
  console.log(`[CrossValidation] Status counts:`, statusCounts);

  // Step 4: Calculate compliance score
  const complianceScore = calculateComplianceScore(statusCounts);
  console.log(`[CrossValidation] Compliance score: ${complianceScore}%`);

  // Step 5: Determine overall status
  const overallStatus = determineOverallStatus(complianceScore, statusCounts.critical);
  console.log(`[CrossValidation] Overall status: ${overallStatus}`);

  // Step 6: Update analysis with results
  await updateStage(prisma, analysisId, "Updating analysis metrics");
  await prisma.analysis.update({
    where: { id: analysisId },
    data: {
      compliance_score: complianceScore,
      overall_status: overallStatus,
      critical_count: statusCounts.critical,
      warning_count: statusCounts.warning,
      compliant_count: statusCounts.compliant,
      not_assessed_count: statusCounts.notAssessed,
      total_checks: statusCounts.total,
    },
  });

  console.log(`[CrossValidation] Cross-validation complete`);

  return {
    validatedResults: deduplicated,
    conflicts,
    statusCounts,
    complianceScore,
    overallStatus,
  };
}
