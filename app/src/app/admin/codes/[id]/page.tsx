"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type BuildingCode = {
  id: string;
  code_id: string;
  name: string;
  region: "AU" | "UK" | "US";
  version: string;
  status: "DRAFT" | "ACTIVE" | "DEPRECATED";
  description: string | null;
  source_document_url: string | null;
  requirement_count: number;
  published_at: string | null;
  created_at: string;
  publisher: {
    id: string;
    name: string | null;
    email: string;
  } | null;
};

type Requirement = {
  id: string;
  code_ref: string;
  title: string;
  category: string;
  check_type: string;
  status: "DRAFT" | "VERIFIED" | "PUBLISHED" | "DEPRECATED";
  source_page: number | null;
  created_at: string;
  updated_at: string;
};

type StatusCounts = {
  draft: number;
  verified: number;
  published: number;
  deprecated: number;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
};

const REGION_FLAGS: Record<string, string> = {
  AU: "\ud83c\udde6\ud83c\uddfa",
  UK: "\ud83c\uddec\ud83c\udde7",
  US: "\ud83c\uddfa\ud83c\uddf8",
};

const REGION_NAMES: Record<string, string> = {
  AU: "Australia",
  UK: "United Kingdom",
  US: "United States",
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-yellow-100 text-yellow-800",
  VERIFIED: "bg-blue-100 text-blue-800",
  PUBLISHED: "bg-green-100 text-green-800",
  DEPRECATED: "bg-gray-100 text-gray-500",
  ACTIVE: "bg-green-100 text-green-800",
};

const CATEGORY_LABELS: Record<string, string> = {
  STRUCTURAL: "Structural",
  FIRE_SAFETY: "Fire Safety",
  EGRESS: "Egress",
  ACCESSIBILITY: "Accessibility",
  ENERGY: "Energy",
  GENERAL_BUILDING: "General Building",
  SITE: "Site",
  PLUMBING: "Plumbing",
  ELECTRICAL: "Electrical",
  MECHANICAL: "Mechanical",
};

export default function AdminCodeDetailPage() {
  const params = useParams();
  const codeId = params.id as string;

  const [code, setCode] = useState<BuildingCode | null>(null);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [statusCounts, setStatusCounts] = useState<StatusCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Upload and extraction state
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>("");

  const fetchCode = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/codes/${codeId}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Building code not found");
        }
        throw new Error("Failed to fetch code");
      }
      const data = await response.json();
      setCode(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  }, [codeId]);

  const fetchRequirements = useCallback(async (page = 1) => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (statusFilter) params.append("status", statusFilter);

      const response = await fetch(`/api/admin/codes/${codeId}/requirements?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch requirements");
      }

      const data = await response.json();
      setRequirements(data.requirements);
      setPagination(data.pagination);
      setStatusCounts(data.counts);
    } catch (err) {
      console.error("Error fetching requirements:", err);
    }
  }, [codeId, statusFilter]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchCode();
      await fetchRequirements();
      setLoading(false);
    };
    init();
  }, [fetchCode, fetchRequirements]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      alert("Only PDF files are allowed");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`/api/admin/codes/${codeId}/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to upload file");
      }

      // Refresh code data to get new source_document_url
      await fetchCode();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleExtract = async () => {
    if (!code?.source_document_url) {
      setError("Please upload a PDF document first");
      return;
    }

    setExtracting(true);
    setExtractionProgress("Starting extraction...");
    setError(null);

    try {
      const response = await fetch(`/api/admin/codes/${codeId}/extract`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to extract requirements");
      }

      const data = await response.json();
      setExtractionProgress(`${data.count} requirements found!`);

      // Refresh requirements list
      await fetchRequirements();
      await fetchCode();

      // Clear progress after a delay
      setTimeout(() => setExtractionProgress(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extraction failed");
      setExtractionProgress(null);
    } finally {
      setExtracting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4" />
          <div className="h-4 bg-gray-100 rounded w-1/2 mb-8" />
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-100 rounded" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !code) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Error</h2>
          <p className="text-red-700">{error}</p>
          <Link
            href="/admin/codes"
            className="text-red-600 hover:text-red-800 text-sm mt-4 inline-block underline"
          >
            Back to Building Codes
          </Link>
        </div>
      </div>
    );
  }

  if (!code) return null;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/admin" className="hover:text-gray-700">
            Admin
          </Link>
          <span>/</span>
          <Link href="/admin/codes" className="hover:text-gray-700">
            Building Codes
          </Link>
          <span>/</span>
          <span>{code.code_id}</span>
        </div>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{code.name}</h1>
              <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[code.status]}`}>
                {code.status}
              </span>
            </div>
            <p className="text-gray-600 mt-1">
              {REGION_FLAGS[code.region]} {REGION_NAMES[code.region]} • Version {code.version}
            </p>
            {code.description && (
              <p className="text-gray-500 text-sm mt-2">{code.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Upload and Extract Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Document Upload & Extraction</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Upload Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Source Document (PDF)
            </label>
            {code.source_document_url ? (
              <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm text-green-800 flex-1">Document uploaded</span>
                <a
                  href={code.source_document_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-600 hover:text-green-800 text-sm underline"
                >
                  View
                </a>
              </div>
            ) : (
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-sm text-gray-600">No document uploaded yet</p>
              </div>
            )}

            <div className="mt-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
                className="hidden"
                id="pdf-upload"
              />
              <label
                htmlFor="pdf-upload"
                className={`inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
                  uploading
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                {uploading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Uploading...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    {code.source_document_url ? "Replace PDF" : "Upload PDF"}
                  </>
                )}
              </label>
            </div>
          </div>

          {/* Extract Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              AI Requirement Extraction
            </label>
            <p className="text-sm text-gray-500 mb-3">
              Use Gemini AI to automatically extract checkable requirements from the uploaded PDF.
            </p>

            {extractionProgress && (
              <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2">
                  {extracting && (
                    <svg className="animate-spin w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  <span className="text-sm text-blue-800">{extractionProgress}</span>
                </div>
              </div>
            )}

            <button
              onClick={handleExtract}
              disabled={!code.source_document_url || extracting}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                !code.source_document_url || extracting
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              {extracting ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Extracting...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  Extract Requirements
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Status Counts */}
      {statusCounts && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-yellow-600">{statusCounts.draft}</div>
            <div className="text-sm text-gray-600">Draft</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-blue-600">{statusCounts.verified}</div>
            <div className="text-sm text-gray-600">Verified</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-green-600">{statusCounts.published}</div>
            <div className="text-sm text-gray-600">Published</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-gray-500">{statusCounts.deprecated}</div>
            <div className="text-sm text-gray-600">Deprecated</div>
          </div>
        </div>
      )}

      {/* Requirements List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Requirements ({pagination?.total || 0})
          </h2>
          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="VERIFIED">Verified</option>
              <option value="PUBLISHED">Published</option>
              <option value="DEPRECATED">Deprecated</option>
            </select>
          </div>
        </div>

        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Code Ref
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Title
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Category
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Page
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {requirements.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center">
                  <div className="text-gray-400">
                    <svg
                      className="w-12 h-12 mx-auto mb-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <p className="text-lg font-medium text-gray-600">
                      No requirements found
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Upload a PDF and use AI extraction to add requirements.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              requirements.map((req) => (
                <tr
                  key={req.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => {
                    // Future: navigate to requirement detail
                  }}
                >
                  <td className="px-6 py-4">
                    <span className="font-mono text-sm text-blue-600">
                      {req.code_ref}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-900 line-clamp-1">
                      {req.title}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-600">
                      {CATEGORY_LABELS[req.category] || req.category}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[req.status]}`}
                    >
                      {req.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {req.source_page || "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {pagination && pagination.total_pages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
              {pagination.total} requirements
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => fetchRequirements(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => fetchRequirements(pagination.page + 1)}
                disabled={pagination.page === pagination.total_pages}
                className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
