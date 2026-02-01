"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import ProjectModal from "@/components/projects/ProjectModal";

type Analysis = {
  id: string;
  report_ref: string;
  document_name: string;
  document_type: "PDF" | "PNG" | "JPG" | "TIFF" | "DXF" | "IFC";
  page_count: number;
  region: "AU" | "UK" | "US";
  status:
    | "PENDING"
    | "CLASSIFYING"
    | "ANALYSING"
    | "VALIDATING"
    | "GENERATING"
    | "COMPLETED"
    | "FAILED";
  compliance_score: number | null;
  overall_status: "PASS" | "CONDITIONAL" | "FAIL" | null;
  critical_count: number;
  warning_count: number;
  compliant_count: number;
  created_at: string;
  completed_at: string | null;
};

type Project = {
  id: string;
  name: string;
  description: string | null;
  folder_id: string | null;
  folder: { id: string; name: string } | null;
  created_at: string;
  updated_at: string;
  analysis_count: number;
};

type PaginationData = {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
};

type AnalysesData = {
  analyses: Analysis[];
  pagination: PaginationData;
};

// Document type icon components
function DocumentTypeIcon({ type }: { type: Analysis["document_type"] }) {
  const iconClasses = "w-5 h-5";

  switch (type) {
    case "PDF":
      return (
        <div className="w-8 h-8 rounded bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
          <svg
            className={`${iconClasses} text-red-600 dark:text-red-400`}
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zm-2.5 9.5c0 .28-.22.5-.5.5h-1v2H8v-5h2c.83 0 1.5.67 1.5 1.5v1zm4 1.5c0 .83-.67 1.5-1.5 1.5h-2v-5h2c.83 0 1.5.67 1.5 1.5v2zm4-.5c0 .28-.22.5-.5.5h-1v1h-1v-5h2.5v1h-1.5v1h1c.28 0 .5.22.5.5v1z" />
          </svg>
        </div>
      );
    case "PNG":
    case "JPG":
    case "TIFF":
      return (
        <div className="w-8 h-8 rounded bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
          <svg
            className={`${iconClasses} text-purple-600 dark:text-purple-400`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
      );
    case "DXF":
    case "IFC":
      return (
        <div className="w-8 h-8 rounded bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
          <svg
            className={`${iconClasses} text-blue-600 dark:text-blue-400`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
        </div>
      );
    default:
      return (
        <div className="w-8 h-8 rounded bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
          <svg
            className={`${iconClasses} text-gray-600 dark:text-gray-400`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
          </svg>
        </div>
      );
  }
}

// Status badge component
function StatusBadge({ status }: { status: Analysis["status"] }) {
  const getStatusStyles = () => {
    switch (status) {
      case "COMPLETED":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "FAILED":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      case "PENDING":
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400";
      case "CLASSIFYING":
      case "ANALYSING":
      case "VALIDATING":
      case "GENERATING":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400";
    }
  };

  const getStatusLabel = () => {
    switch (status) {
      case "CLASSIFYING":
        return "Classifying";
      case "ANALYSING":
        return "Analysing";
      case "VALIDATING":
        return "Validating";
      case "GENERATING":
        return "Generating";
      default:
        return status.charAt(0) + status.slice(1).toLowerCase();
    }
  };

  const isProcessing = [
    "CLASSIFYING",
    "ANALYSING",
    "VALIDATING",
    "GENERATING",
  ].includes(status);

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusStyles()}`}
    >
      {isProcessing && (
        <svg
          className="animate-spin -ml-0.5 mr-1.5 h-3 w-3"
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
      )}
      {getStatusLabel()}
    </span>
  );
}

// Overall status badge component
function OverallStatusBadge({
  status,
}: {
  status: Analysis["overall_status"];
}) {
  if (!status) return <span className="text-gray-400">—</span>;

  const getStyles = () => {
    switch (status) {
      case "PASS":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "CONDITIONAL":
        return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
      case "FAIL":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400";
    }
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStyles()}`}
    >
      {status}
    </span>
  );
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatScore(score: number | null): string {
  if (score === null) return "—";
  return `${Math.round(score)}%`;
}

function EmptyState({ onNewAnalysis }: { onNewAnalysis: () => void }) {
  return (
    <div className="text-center py-16 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
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
            d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        No analyses yet
      </h3>
      <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-sm mx-auto">
        Upload your first building plan to start a compliance analysis.
      </p>
      <button
        onClick={onNewAnalysis}
        className="inline-flex items-center px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
      >
        <svg
          className="w-5 h-5 mr-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
          />
        </svg>
        New Analysis
      </button>
    </div>
  );
}

function AnalysisTable({
  analyses,
  projectId,
}: {
  analyses: Analysis[];
  projectId: string;
}) {
  const router = useRouter();

  const handleRowClick = (analysis: Analysis) => {
    if (analysis.status === "COMPLETED") {
      router.push(`/projects/${projectId}/analyses/${analysis.id}/report`);
    } else if (
      ["PENDING", "CLASSIFYING", "ANALYSING", "VALIDATING", "GENERATING"].includes(
        analysis.status
      )
    ) {
      router.push(`/projects/${projectId}/analyses/${analysis.id}/processing`);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
              >
                Document
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
              >
                Report Ref
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
              >
                Status
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
              >
                Result
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
              >
                Score
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
              >
                Date
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {analyses.map((analysis) => (
              <tr
                key={analysis.id}
                onClick={() => handleRowClick(analysis)}
                className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <DocumentTypeIcon type={analysis.document_type} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-xs">
                        {analysis.document_name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {analysis.page_count}{" "}
                        {analysis.page_count === 1 ? "page" : "pages"} •{" "}
                        {analysis.document_type}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-mono text-gray-600 dark:text-gray-300">
                    {analysis.report_ref}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <StatusBadge status={analysis.status} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <OverallStatusBadge status={analysis.overall_status} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`text-sm font-medium ${
                      analysis.compliance_score !== null
                        ? analysis.compliance_score >= 90
                          ? "text-green-600 dark:text-green-400"
                          : analysis.compliance_score >= 70
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-red-600 dark:text-red-400"
                        : "text-gray-400"
                    }`}
                  >
                    {formatScore(analysis.compliance_score)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {formatDate(analysis.created_at)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="flex items-center justify-end gap-2">
                    {analysis.status === "COMPLETED" && (
                      <>
                        <Link
                          href={`/projects/${projectId}/analyses/${analysis.id}/report`}
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                          title="View report"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            />
                          </svg>
                        </Link>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // TODO: Implement share functionality
                          }}
                          className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                          title="Share report"
                        >
                          <svg
                            className="w-4 h-4"
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
                        </button>
                      </>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // TODO: Implement delete functionality
                      }}
                      className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                      title="Delete analysis"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Pagination({
  pagination,
  onPageChange,
}: {
  pagination: PaginationData;
  onPageChange: (page: number) => void;
}) {
  const { page, total_pages } = pagination;

  if (total_pages <= 1) return null;

  const pages: (number | "ellipsis")[] = [];
  const maxVisiblePages = 5;

  if (total_pages <= maxVisiblePages) {
    for (let i = 1; i <= total_pages; i++) {
      pages.push(i);
    }
  } else {
    pages.push(1);
    if (page > 3) {
      pages.push("ellipsis");
    }
    const start = Math.max(2, page - 1);
    const end = Math.min(total_pages - 1, page + 1);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    if (page < total_pages - 2) {
      pages.push("ellipsis");
    }
    pages.push(total_pages);
  }

  return (
    <div className="flex items-center justify-center gap-1 mt-6">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Previous
      </button>
      {pages.map((p, i) =>
        p === "ellipsis" ? (
          <span key={`ellipsis-${i}`} className="px-3 py-2 text-gray-400">
            ...
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`px-3 py-2 text-sm rounded-lg transition-colors ${
              p === page
                ? "bg-blue-600 text-white"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
          >
            {p}
          </button>
        )
      )}
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page === total_pages}
        className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Next
      </button>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="flex items-center gap-2 mb-6">
        <div className="h-4 w-20 bg-gray-200 dark:bg-gray-800 rounded" />
        <div className="h-4 w-4 bg-gray-200 dark:bg-gray-800 rounded" />
        <div className="h-4 w-32 bg-gray-200 dark:bg-gray-800 rounded" />
      </div>
      <div className="h-8 w-64 bg-gray-200 dark:bg-gray-800 rounded mb-2" />
      <div className="h-4 w-96 bg-gray-200 dark:bg-gray-800 rounded mb-6" />
      <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded-lg" />
    </div>
  );
}

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [analysesData, setAnalysesData] = useState<AnalysesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = "/api/auth/login";
          return null;
        }
        if (res.status === 403) {
          throw new Error("Access denied");
        }
        if (res.status === 404) {
          throw new Error("Project not found");
        }
        throw new Error("Failed to fetch project");
      }
      return await res.json();
    } catch (err) {
      throw err;
    }
  }, [projectId]);

  const fetchAnalyses = useCallback(
    async (page: number) => {
      try {
        const res = await fetch(
          `/api/projects/${projectId}/analyses?page=${page}&limit=10`
        );
        if (!res.ok) {
          if (res.status === 401) {
            window.location.href = "/api/auth/login";
            return null;
          }
          throw new Error("Failed to fetch analyses");
        }
        return await res.json();
      } catch (err) {
        throw err;
      }
    },
    [projectId]
  );

  const loadData = useCallback(
    async (page: number = 1) => {
      setLoading(true);
      setError(null);
      try {
        const [projectData, analysesResult] = await Promise.all([
          fetchProject(),
          fetchAnalyses(page),
        ]);
        if (projectData) setProject(projectData);
        if (analysesResult) setAnalysesData(analysesResult);
        setCurrentPage(page);
      } catch (err) {
        console.error("Error loading data:", err);
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    },
    [fetchProject, fetchAnalyses]
  );

  useEffect(() => {
    loadData(1);
  }, [loadData]);

  const handlePageChange = (page: number) => {
    loadData(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleNewAnalysis = () => {
    // TODO: Navigate to wizard when implemented
    router.push(`/projects/${projectId}/analyses/new`);
  };

  const handleEditProject = () => {
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
  };

  const handleModalSuccess = () => {
    loadData(currentPage);
  };

  if (loading && !project) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => loadData(currentPage)}
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Try again
          </button>
          <Link
            href="/projects"
            className="text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            Back to projects
          </Link>
        </div>
      </div>
    );
  }

  if (!project) {
    return null;
  }

  const analyses = analysesData?.analyses || [];
  const pagination = analysesData?.pagination;

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-6">
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
        <span className="text-gray-900 dark:text-white">{project.name}</span>
      </nav>

      {/* Project Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white truncate">
              {project.name}
            </h1>
            <button
              onClick={handleEditProject}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
              title="Edit project"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </button>
          </div>
          {project.description && (
            <p className="text-gray-600 dark:text-gray-400 max-w-2xl">
              {project.description}
            </p>
          )}
          {project.folder && (
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
              <span className="inline-flex items-center gap-1">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                  />
                </svg>
                {project.folder.name}
              </span>
            </p>
          )}
        </div>
        <button
          onClick={handleNewAnalysis}
          className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex-shrink-0"
        >
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          New Analysis
        </button>
      </div>

      {/* Analyses Section */}
      <div className="mb-4">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white">
          Analyses{" "}
          <span className="text-gray-500 dark:text-gray-400 font-normal">
            ({project.analysis_count})
          </span>
        </h2>
      </div>

      {analyses.length === 0 ? (
        <EmptyState onNewAnalysis={handleNewAnalysis} />
      ) : (
        <>
          <AnalysisTable analyses={analyses} projectId={projectId} />
          {pagination && (
            <Pagination pagination={pagination} onPageChange={handlePageChange} />
          )}
        </>
      )}

      {/* Project Edit Modal */}
      <ProjectModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
        project={{
          id: project.id,
          name: project.name,
          description: project.description,
          folder_id: project.folder_id,
        }}
      />
    </div>
  );
}
