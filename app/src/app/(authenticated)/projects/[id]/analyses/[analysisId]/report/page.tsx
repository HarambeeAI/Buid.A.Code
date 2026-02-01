"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

// Types
type FindingStatus = "COMPLIANT" | "WARNING" | "CRITICAL" | "NOT_ASSESSED";
type Confidence = "HIGH" | "MEDIUM" | "LOW";
type OverallStatus = "PASS" | "CONDITIONAL" | "FAIL";

type Finding = {
  id: string;
  code_reference: string;
  category: string;
  status: FindingStatus;
  confidence: Confidence;
  description: string;
  required_value: string;
  proposed_value: string | null;
  page_number: number | null;
  location: string | null;
  analysis_notes: string;
  recommendation: string | null;
  sort_order: number;
};

type ReportData = {
  report_ref: string;
  document_name: string;
  document_url: string;
  document_type: string;
  page_count: number;
  description: string | null;
  region: string;
  selected_codes: string[];
  status: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  project: {
    id: string;
    name: string;
  };
  summary: {
    total_findings: number;
    critical_count: number;
    warning_count: number;
    compliant_count: number;
    not_assessed_count: number;
    total_checks: number;
    compliance_score: number | null;
    overall_status: OverallStatus | null;
  };
  confidence_breakdown: {
    high: number;
    medium: number;
    low: number;
  };
  findings_by_category: Record<string, Finding[]>;
  findings: Finding[];
};

type User = {
  id: string;
  email: string;
  name: string | null;
  tier: "FREE" | "PRO";
  analyses_remaining: number | null;
  role: "USER" | "ADMIN";
};

// Score Donut component
function ScoreDonut({
  score,
  size = 160,
}: {
  score: number | null;
  size?: number;
}) {
  const displayScore = score ?? 0;
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (displayScore / 100) * circumference;

  const getColor = () => {
    if (displayScore >= 90) return "#22c55e";
    if (displayScore >= 70) return "#f59e0b";
    return "#ef4444";
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth="12"
          fill="transparent"
          className="text-gray-200 dark:text-gray-700"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={getColor()}
          strokeWidth="12"
          fill="transparent"
          strokeLinecap="round"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-3xl font-bold"
          style={{ color: getColor() }}
        >
          {score !== null ? Math.round(score) : "—"}
        </span>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {score !== null ? "%" : "N/A"}
        </span>
      </div>
    </div>
  );
}

// Status Stamp component
function StatusStamp({ status }: { status: OverallStatus | null }) {
  if (!status) return null;

  const getStyles = () => {
    switch (status) {
      case "PASS":
        return "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700";
      case "CONDITIONAL":
        return "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700";
      case "FAIL":
        return "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700";
      default:
        return "bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700";
    }
  };

  return (
    <div
      className={`inline-flex items-center px-4 py-2 text-lg font-bold uppercase tracking-wider border-2 rounded-lg ${getStyles()}`}
    >
      {status}
    </div>
  );
}

// Breakdown Bar component
function BreakdownBar({
  critical,
  warning,
  compliant,
  notAssessed,
}: {
  critical: number;
  warning: number;
  compliant: number;
  notAssessed: number;
}) {
  const total = critical + warning + compliant + notAssessed;
  if (total === 0) return null;

  const criticalWidth = (critical / total) * 100;
  const warningWidth = (warning / total) * 100;
  const compliantWidth = (compliant / total) * 100;
  const notAssessedWidth = (notAssessed / total) * 100;

  return (
    <div className="space-y-3">
      {/* Bar */}
      <div className="h-4 rounded-full overflow-hidden flex bg-gray-200 dark:bg-gray-700">
        {critical > 0 && (
          <div
            className="bg-red-500 transition-all duration-300"
            style={{ width: `${criticalWidth}%` }}
          />
        )}
        {warning > 0 && (
          <div
            className="bg-amber-500 transition-all duration-300"
            style={{ width: `${warningWidth}%` }}
          />
        )}
        {compliant > 0 && (
          <div
            className="bg-green-500 transition-all duration-300"
            style={{ width: `${compliantWidth}%` }}
          />
        )}
        {notAssessed > 0 && (
          <div
            className="bg-gray-400 dark:bg-gray-500 transition-all duration-300"
            style={{ width: `${notAssessedWidth}%` }}
          />
        )}
      </div>
      {/* Legend */}
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-gray-600 dark:text-gray-400">
            Critical ({critical})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-amber-500" />
          <span className="text-gray-600 dark:text-gray-400">
            Warning ({warning})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-gray-600 dark:text-gray-400">
            Compliant ({compliant})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-gray-400 dark:bg-gray-500" />
          <span className="text-gray-600 dark:text-gray-400">
            Not Assessed ({notAssessed})
          </span>
        </div>
      </div>
    </div>
  );
}

// View Toggle component (Report/Plan)
function ViewToggle({
  view,
  onChange,
}: {
  view: "report" | "plan";
  onChange: (view: "report" | "plan") => void;
}) {
  return (
    <div className="inline-flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
      <button
        onClick={() => onChange("report")}
        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
          view === "report"
            ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
            : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        }`}
      >
        Report
      </button>
      <button
        onClick={() => onChange("plan")}
        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
          view === "plan"
            ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
            : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        }`}
      >
        Plan
      </button>
    </div>
  );
}

// Category label formatter
function formatCategory(category: string): string {
  return category
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

// Date formatter
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Loading skeleton
function LoadingSkeleton() {
  return (
    <div className="flex flex-col lg:flex-row gap-6 animate-pulse">
      {/* Left Panel Skeleton */}
      <div className="w-full lg:w-72 flex-shrink-0">
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 space-y-6">
          <div className="flex justify-center">
            <div className="w-40 h-40 rounded-full bg-gray-200 dark:bg-gray-800" />
          </div>
          <div className="h-10 w-32 mx-auto bg-gray-200 dark:bg-gray-800 rounded" />
          <div className="h-32 bg-gray-200 dark:bg-gray-800 rounded" />
        </div>
      </div>
      {/* Center Panel Skeleton */}
      <div className="flex-1">
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
          <div className="h-8 w-48 bg-gray-200 dark:bg-gray-800 rounded mb-6" />
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-200 dark:bg-gray-800 rounded" />
            ))}
          </div>
        </div>
      </div>
      {/* Right Panel Skeleton */}
      <div className="w-full lg:w-64 flex-shrink-0">
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
          <div className="h-6 w-24 bg-gray-200 dark:bg-gray-800 rounded mb-4" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-8 bg-gray-200 dark:bg-gray-800 rounded" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ReportPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const analysisId = params.analysisId as string;

  const [report, setReport] = useState<ReportData | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"report" | "plan">("report");
  const [shareLoading, setShareLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [exportLoading, setExportLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    try {
      const res = await fetch(`/api/analyses/${analysisId}/report`);
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = "/api/auth/login";
          return null;
        }
        if (res.status === 403) {
          throw new Error("Access denied");
        }
        if (res.status === 404) {
          throw new Error("Report not found");
        }
        throw new Error("Failed to fetch report");
      }
      return await res.json();
    } catch (err) {
      throw err;
    }
  }, [analysisId]);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [reportData, userData] = await Promise.all([
        fetchReport(),
        fetchUser(),
      ]);
      if (reportData) setReport(reportData);
      if (userData) setUser(userData);
    } catch (err) {
      console.error("Error loading report:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [fetchReport, fetchUser]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleShare = async () => {
    if (!report) return;
    setShareLoading(true);
    try {
      const res = await fetch(`/api/analyses/${analysisId}/share`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to create share link");
      const data = await res.json();
      setShareUrl(data.share_url);
      // Copy to clipboard
      await navigator.clipboard.writeText(data.share_url);
    } catch (err) {
      console.error("Error sharing report:", err);
    } finally {
      setShareLoading(false);
    }
  };

  const handleExport = async () => {
    if (!report) return;

    // Check tier
    if (user?.tier === "FREE") {
      // Show upgrade message
      alert("PDF export requires a Pro subscription. Upgrade to unlock this feature.");
      return;
    }

    setExportLoading(true);
    try {
      const res = await fetch(`/api/analyses/${analysisId}/export`);
      if (!res.ok) {
        if (res.status === 403) {
          alert("PDF export requires a Pro subscription.");
          return;
        }
        throw new Error("Failed to export report");
      }
      // Download the PDF
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `BuildACode_Report_${report.report_ref}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Error exporting report:", err);
    } finally {
      setExportLoading(false);
    }
  };

  if (loading) {
    return (
      <div>
        {/* Header Skeleton */}
        <div className="mb-6 animate-pulse">
          <div className="h-4 w-48 bg-gray-200 dark:bg-gray-800 rounded mb-4" />
          <div className="flex items-center justify-between">
            <div className="h-6 w-64 bg-gray-200 dark:bg-gray-800 rounded" />
            <div className="h-10 w-32 bg-gray-200 dark:bg-gray-800 rounded" />
          </div>
        </div>
        <LoadingSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={loadData}
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Try again
          </button>
          <Link
            href={`/projects/${projectId}`}
            className="text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            Back to project
          </Link>
        </div>
      </div>
    );
  }

  if (!report) {
    return null;
  }

  const { summary, findings_by_category, findings } = report;
  const categories = Object.keys(findings_by_category);

  return (
    <div>
      {/* Report Header */}
      <div className="mb-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
          <Link
            href="/projects"
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            Projects
          </Link>
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
              clipRule="evenodd"
            />
          </svg>
          <Link
            href={`/projects/${projectId}`}
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            {report.project.name}
          </Link>
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-gray-900 dark:text-white font-mono text-xs">
            {report.report_ref}
          </span>
        </nav>

        {/* Header Row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">
              Compliance Report
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {report.document_name} • {formatDate(report.created_at)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ViewToggle view={view} onChange={setView} />
            <button
              onClick={handleShare}
              disabled={shareLoading}
              className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {shareLoading ? (
                <svg
                  className="animate-spin w-4 h-4 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                  />
                </svg>
              )}
              {shareUrl ? "Copied!" : "Share"}
            </button>
            <button
              onClick={handleExport}
              disabled={exportLoading}
              className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 transition-colors"
            >
              {exportLoading ? (
                <svg
                  className="animate-spin w-4 h-4 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              )}
              {user?.tier === "FREE" ? "Export (Pro)" : "Export PDF"}
            </button>
          </div>
        </div>
      </div>

      {/* Share URL notification */}
      {shareUrl && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center justify-between">
          <span className="text-sm text-green-700 dark:text-green-400">
            Link copied to clipboard!
          </span>
          <button
            onClick={() => setShareUrl(null)}
            className="text-green-700 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Three-Panel Layout */}
      {view === "report" ? (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left Panel - Score, Status, Breakdown */}
          <div className="w-full lg:w-72 flex-shrink-0">
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 space-y-6 sticky top-6">
              {/* Score Donut */}
              <div className="flex justify-center">
                <ScoreDonut score={summary.compliance_score} />
              </div>

              {/* Status Stamp */}
              <div className="flex justify-center">
                <StatusStamp status={summary.overall_status} />
              </div>

              {/* Breakdown */}
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                  Findings Breakdown
                </h3>
                <BreakdownBar
                  critical={summary.critical_count}
                  warning={summary.warning_count}
                  compliant={summary.compliant_count}
                  notAssessed={summary.not_assessed_count}
                />
              </div>

              {/* Summary Stats */}
              <div className="border-t border-gray-200 dark:border-gray-800 pt-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">
                      Total Checks
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {summary.total_checks}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">
                      Region
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {report.region}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">
                      Pages
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {report.page_count}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Center Panel - Findings */}
          <div className="flex-1 min-w-0">
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                Findings
              </h2>

              {findings.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  No findings recorded for this analysis.
                </div>
              ) : (
                <div className="space-y-8">
                  {categories.map((category) => (
                    <div key={category} id={`category-${category}`}>
                      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <span>{formatCategory(category)}</span>
                        <span className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                          {findings_by_category[category].length}
                        </span>
                      </h3>
                      <div className="space-y-4">
                        {findings_by_category[category].map((finding) => (
                          <FindingCard key={finding.id} finding={finding} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Quick Nav */}
          <div className="w-full lg:w-64 flex-shrink-0">
            <QuickNav
              findings={findings}
              categories={categories}
              findingsByCategory={findings_by_category}
            />
          </div>
        </div>
      ) : (
        /* Plan View - Document Viewer Placeholder */
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-12 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <svg
              className="w-10 h-10 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Document Viewer
          </h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            The document viewer will be implemented in a future update. You can
            download the original document to view it locally.
          </p>
          <a
            href={report.document_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Download Document
          </a>
        </div>
      )}
    </div>
  );
}

// Finding Card Component
function FindingCard({ finding }: { finding: Finding }) {
  const getStatusStyles = () => {
    switch (finding.status) {
      case "CRITICAL":
        return "border-l-red-500 bg-red-50/50 dark:bg-red-900/10";
      case "WARNING":
        return "border-l-amber-500";
      case "COMPLIANT":
        return "border-l-green-500";
      case "NOT_ASSESSED":
        return "border-l-gray-400";
      default:
        return "border-l-gray-300";
    }
  };

  const getStatusBadgeStyles = () => {
    switch (finding.status) {
      case "CRITICAL":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      case "WARNING":
        return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
      case "COMPLIANT":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "NOT_ASSESSED":
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400";
    }
  };

  const getConfidenceBadgeStyles = () => {
    switch (finding.confidence) {
      case "HIGH":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800";
      case "MEDIUM":
        return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800";
      case "LOW":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800 border-dashed";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400";
    }
  };

  return (
    <div
      id={`finding-${finding.id}`}
      className={`border-l-4 rounded-lg p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 ${getStatusStyles()}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-medium text-gray-900 dark:text-white">
            {finding.code_reference}
          </span>
          <span
            className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusBadgeStyles()}`}
          >
            {finding.status.replace("_", " ")}
          </span>
          <span
            className={`px-2 py-0.5 text-xs font-medium rounded border ${getConfidenceBadgeStyles()}`}
          >
            {finding.confidence}
          </span>
        </div>
        {finding.page_number && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Page {finding.page_number}
          </span>
        )}
      </div>

      {/* Description */}
      <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
        {finding.description}
      </p>

      {/* Required vs Proposed */}
      <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
        <div>
          <span className="text-gray-500 dark:text-gray-400 block mb-1">
            Required
          </span>
          <span className="text-gray-900 dark:text-white">
            {finding.required_value}
          </span>
        </div>
        {finding.proposed_value && (
          <div>
            <span className="text-gray-500 dark:text-gray-400 block mb-1">
              As Shown
            </span>
            <span className="text-gray-900 dark:text-white">
              {finding.proposed_value}
            </span>
          </div>
        )}
      </div>

      {/* Location */}
      {finding.location && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          Location: {finding.location}
        </p>
      )}

      {/* LOW confidence warning */}
      {finding.confidence === "LOW" && (
        <div className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1 mb-2">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          Verify manually - low confidence extraction
        </div>
      )}

      {/* Recommendation */}
      {finding.recommendation && (
        <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
          <div className="flex items-start gap-2">
            <svg
              className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              {finding.recommendation}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Quick Nav Component
function QuickNav({
  findings,
  categories,
  findingsByCategory,
}: {
  findings: Finding[];
  categories: string[];
  findingsByCategory: Record<string, Finding[]>;
}) {
  const [filter, setFilter] = useState<FindingStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");

  const getStatusDotColor = (status: FindingStatus) => {
    switch (status) {
      case "CRITICAL":
        return "bg-red-500";
      case "WARNING":
        return "bg-amber-500";
      case "COMPLIANT":
        return "bg-green-500";
      case "NOT_ASSESSED":
        return "bg-gray-400";
      default:
        return "bg-gray-400";
    }
  };

  const filteredFindings = findings.filter((f) => {
    const matchesFilter = filter === "ALL" || f.status === filter;
    const matchesSearch =
      search === "" ||
      f.code_reference.toLowerCase().includes(search.toLowerCase()) ||
      f.description.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const scrollToFinding = (findingId: string) => {
    const element = document.getElementById(`finding-${findingId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.classList.add("ring-2", "ring-blue-500");
      setTimeout(() => {
        element.classList.remove("ring-2", "ring-blue-500");
      }, 2000);
    }
  };

  const scrollToCategory = (category: string) => {
    const element = document.getElementById(`category-${category}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 sticky top-6">
      <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">
        Quick Navigation
      </h3>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search findings..."
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-1 mb-4">
        {(["ALL", "CRITICAL", "WARNING", "COMPLIANT", "NOT_ASSESSED"] as const).map(
          (status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                filter === status
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {status === "ALL" ? "All" : status.charAt(0) + status.slice(1).toLowerCase().replace("_", " ")}
            </button>
          )
        )}
      </div>

      {/* Category Links */}
      <div className="mb-4">
        <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
          Categories
        </h4>
        <div className="space-y-1">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => scrollToCategory(category)}
              className="w-full text-left px-2 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
            >
              {formatCategory(category)} ({findingsByCategory[category].length})
            </button>
          ))}
        </div>
      </div>

      {/* Finding List */}
      <div>
        <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
          Findings ({filteredFindings.length})
        </h4>
        <div className="space-y-1 max-h-[400px] overflow-y-auto">
          {filteredFindings.map((finding) => (
            <button
              key={finding.id}
              onClick={() => scrollToFinding(finding.id)}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
            >
              <span
                className={`w-2 h-2 rounded-full flex-shrink-0 ${getStatusDotColor(
                  finding.status
                )}`}
              />
              <span className="font-mono text-xs text-gray-900 dark:text-white truncate">
                {finding.code_reference}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
