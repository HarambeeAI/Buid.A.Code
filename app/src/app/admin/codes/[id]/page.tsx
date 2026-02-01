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
  full_text: string;
  check_type: string;
  thresholds: Record<string, unknown>;
  applies_to_drawing_types: string[];
  applies_to_building_types: string[];
  applies_to_spaces: string[];
  exceptions: string[];
  extraction_guidance: string;
  evaluation_guidance: string;
  status: "DRAFT" | "VERIFIED" | "PUBLISHED" | "DEPRECATED";
  source_page: number | null;
  created_at: string;
  updated_at: string;
};

type RequirementListItem = {
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

const CATEGORY_OPTIONS = [
  { value: "STRUCTURAL", label: "Structural" },
  { value: "FIRE_SAFETY", label: "Fire Safety" },
  { value: "EGRESS", label: "Egress" },
  { value: "ACCESSIBILITY", label: "Accessibility" },
  { value: "ENERGY", label: "Energy" },
  { value: "GENERAL_BUILDING", label: "General Building" },
  { value: "SITE", label: "Site" },
  { value: "PLUMBING", label: "Plumbing" },
  { value: "ELECTRICAL", label: "Electrical" },
  { value: "MECHANICAL", label: "Mechanical" },
];

const CHECK_TYPE_OPTIONS = [
  { value: "MEASUREMENT_THRESHOLD", label: "Measurement Threshold" },
  { value: "PRESENCE_CHECK", label: "Presence Check" },
  { value: "RATIO_CHECK", label: "Ratio Check" },
  { value: "BOOLEAN_CHECK", label: "Boolean Check" },
];

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  CATEGORY_OPTIONS.map((c) => [c.value, c.label])
);

// Requirement Edit Modal Component
function RequirementEditModal({
  requirement,
  onClose,
  onSave,
  onDelete,
  onVerify,
}: {
  requirement: Requirement;
  onClose: () => void;
  onSave: (data: Partial<Requirement>) => Promise<void>;
  onDelete: () => Promise<void>;
  onVerify: () => Promise<void>;
}) {
  const [formData, setFormData] = useState({
    code_ref: requirement.code_ref,
    title: requirement.title,
    category: requirement.category,
    full_text: requirement.full_text,
    check_type: requirement.check_type,
    thresholds: JSON.stringify(requirement.thresholds, null, 2),
    applies_to_drawing_types: JSON.stringify(requirement.applies_to_drawing_types, null, 2),
    applies_to_building_types: JSON.stringify(requirement.applies_to_building_types, null, 2),
    applies_to_spaces: JSON.stringify(requirement.applies_to_spaces, null, 2),
    exceptions: JSON.stringify(requirement.exceptions, null, 2),
    extraction_guidance: requirement.extraction_guidance,
    evaluation_guidance: requirement.evaluation_guidance,
    source_page: requirement.source_page?.toString() || "",
  });

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSave = async () => {
    setError(null);
    setSaving(true);

    try {
      // Parse JSON fields
      let thresholds, applies_to_drawing_types, applies_to_building_types, applies_to_spaces, exceptions;
      try {
        thresholds = JSON.parse(formData.thresholds);
      } catch {
        throw new Error("Invalid JSON in thresholds field");
      }
      try {
        applies_to_drawing_types = JSON.parse(formData.applies_to_drawing_types);
      } catch {
        throw new Error("Invalid JSON in applies_to_drawing_types field");
      }
      try {
        applies_to_building_types = JSON.parse(formData.applies_to_building_types);
      } catch {
        throw new Error("Invalid JSON in applies_to_building_types field");
      }
      try {
        applies_to_spaces = JSON.parse(formData.applies_to_spaces);
      } catch {
        throw new Error("Invalid JSON in applies_to_spaces field");
      }
      try {
        exceptions = JSON.parse(formData.exceptions);
      } catch {
        throw new Error("Invalid JSON in exceptions field");
      }

      await onSave({
        code_ref: formData.code_ref,
        title: formData.title,
        category: formData.category,
        full_text: formData.full_text,
        check_type: formData.check_type,
        thresholds,
        applies_to_drawing_types,
        applies_to_building_types,
        applies_to_spaces,
        exceptions,
        extraction_guidance: formData.extraction_guidance,
        evaluation_guidance: formData.evaluation_guidance,
        source_page: formData.source_page ? parseInt(formData.source_page, 10) : null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
      setDeleting(false);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    setError(null);
    try {
      await onVerify();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Edit Requirement</h2>
            <p className="text-sm text-gray-500 mt-1">
              {requirement.code_ref} • Status:{" "}
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[requirement.status]}`}>
                {requirement.status}
              </span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Code Reference *
                </label>
                <input
                  type="text"
                  value={formData.code_ref}
                  onChange={(e) => setFormData({ ...formData, code_ref: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                  placeholder="e.g., R302.1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Requirement title"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Check Type *
                  </label>
                  <select
                    value={formData.check_type}
                    onChange={(e) => setFormData({ ...formData, check_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {CHECK_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Source Page
                </label>
                <input
                  type="number"
                  value={formData.source_page}
                  onChange={(e) => setFormData({ ...formData, source_page: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Page number"
                  min="1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Text *
                </label>
                <textarea
                  value={formData.full_text}
                  onChange={(e) => setFormData({ ...formData, full_text: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-32 resize-none"
                  placeholder="Complete requirement text..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Extraction Guidance *
                </label>
                <textarea
                  value={formData.extraction_guidance}
                  onChange={(e) => setFormData({ ...formData, extraction_guidance: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-24 resize-none"
                  placeholder="Instructions for AI to extract relevant data..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Evaluation Guidance *
                </label>
                <textarea
                  value={formData.evaluation_guidance}
                  onChange={(e) => setFormData({ ...formData, evaluation_guidance: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-24 resize-none"
                  placeholder="Instructions for AI to evaluate compliance..."
                />
              </div>
            </div>

            {/* Right Column - JSON Editors */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Thresholds (JSON)
                </label>
                <textarea
                  value={formData.thresholds}
                  onChange={(e) => setFormData({ ...formData, thresholds: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-24 resize-none font-mono text-sm"
                  placeholder="{}"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Applies to Drawing Types (JSON Array)
                </label>
                <textarea
                  value={formData.applies_to_drawing_types}
                  onChange={(e) => setFormData({ ...formData, applies_to_drawing_types: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-20 resize-none font-mono text-sm"
                  placeholder='["floor_plan", "elevation"]'
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Applies to Building Types (JSON Array)
                </label>
                <textarea
                  value={formData.applies_to_building_types}
                  onChange={(e) => setFormData({ ...formData, applies_to_building_types: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-20 resize-none font-mono text-sm"
                  placeholder='["residential", "commercial"]'
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Applies to Spaces (JSON Array)
                </label>
                <textarea
                  value={formData.applies_to_spaces}
                  onChange={(e) => setFormData({ ...formData, applies_to_spaces: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-20 resize-none font-mono text-sm"
                  placeholder='["bedroom", "bathroom"]'
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Exceptions (JSON Array)
                </label>
                <textarea
                  value={formData.exceptions}
                  onChange={(e) => setFormData({ ...formData, exceptions: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-24 resize-none font-mono text-sm"
                  placeholder='["Exception 1", "Exception 2"]'
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {requirement.status === "DRAFT" && (
              <button
                onClick={handleVerify}
                disabled={verifying}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {verifying ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Verifying...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Verify
                  </>
                )}
              </button>
            )}
            {showDeleteConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-red-600">Are you sure?</span>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
                >
                  {deleting ? "Deleting..." : "Yes, Delete"}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1.5 border border-gray-300 text-sm rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="inline-flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !formData.code_ref || !formData.title || !formData.full_text}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {saving ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminCodeDetailPage() {
  const params = useParams();
  const codeId = params.id as string;

  const [code, setCode] = useState<BuildingCode | null>(null);
  const [requirements, setRequirements] = useState<RequirementListItem[]>([]);
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

  // Edit modal state
  const [editingRequirement, setEditingRequirement] = useState<Requirement | null>(null);
  const [loadingRequirement, setLoadingRequirement] = useState<string | null>(null);

  // Bulk verify state
  const [bulkVerifying, setBulkVerifying] = useState(false);

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

  const handleRowClick = async (reqId: string) => {
    setLoadingRequirement(reqId);
    try {
      const response = await fetch(`/api/admin/requirements/${reqId}`);
      if (!response.ok) {
        throw new Error("Failed to load requirement");
      }
      const data = await response.json();
      setEditingRequirement(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load requirement");
    } finally {
      setLoadingRequirement(null);
    }
  };

  const handleSaveRequirement = async (data: Partial<Requirement>) => {
    if (!editingRequirement) return;

    const response = await fetch(`/api/admin/requirements/${editingRequirement.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || "Failed to save requirement");
    }

    setEditingRequirement(null);
    await fetchRequirements(pagination?.page);
  };

  const handleDeleteRequirement = async () => {
    if (!editingRequirement) return;

    const response = await fetch(`/api/admin/requirements/${editingRequirement.id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || "Failed to delete requirement");
    }

    setEditingRequirement(null);
    await fetchRequirements(pagination?.page);
    await fetchCode();
  };

  const handleVerifyRequirement = async () => {
    if (!editingRequirement) return;

    const response = await fetch(`/api/admin/requirements/${editingRequirement.id}/verify`, {
      method: "PATCH",
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || "Failed to verify requirement");
    }

    // Update the local state
    setEditingRequirement({ ...editingRequirement, status: "VERIFIED" });
    await fetchRequirements(pagination?.page);
  };

  const handleBulkVerify = async () => {
    if (!statusCounts || statusCounts.draft === 0) return;

    setBulkVerifying(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/codes/${codeId}/verify-all`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to verify requirements");
      }

      const data = await response.json();
      alert(data.message);

      await fetchRequirements();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk verify failed");
    } finally {
      setBulkVerifying(false);
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
            {statusCounts && statusCounts.draft > 0 && (
              <button
                onClick={handleBulkVerify}
                disabled={bulkVerifying}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {bulkVerifying ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Verifying...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Verify All ({statusCounts.draft})
                  </>
                )}
              </button>
            )}
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
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {requirements.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center">
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
                  className={`hover:bg-gray-50 cursor-pointer ${loadingRequirement === req.id ? "bg-gray-50" : ""}`}
                  onClick={() => handleRowClick(req.id)}
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
                  <td className="px-6 py-4">
                    {loadingRequirement === req.id ? (
                      <svg className="animate-spin w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    )}
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

      {/* Edit Modal */}
      {editingRequirement && (
        <RequirementEditModal
          requirement={editingRequirement}
          onClose={() => setEditingRequirement(null)}
          onSave={handleSaveRequirement}
          onDelete={handleDeleteRequirement}
          onVerify={handleVerifyRequirement}
        />
      )}
    </div>
  );
}
