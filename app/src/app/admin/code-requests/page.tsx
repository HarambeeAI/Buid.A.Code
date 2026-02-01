"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type User = {
  id: string;
  name: string | null;
  email: string;
};

type ResolvedCode = {
  id: string;
  code_id: string;
  name: string;
  region?: string;
  version?: string;
  status?: string;
};

type CodeRequest = {
  id: string;
  code_name: string;
  region: "AU" | "UK" | "US";
  description: string | null;
  reference_url: string | null;
  status: "SUBMITTED" | "UNDER_REVIEW" | "IN_PROGRESS" | "PUBLISHED" | "DECLINED";
  admin_notes: string | null;
  resolved_code_id: string | null;
  created_at: string;
  updated_at: string;
  user: User;
  resolvedCode: ResolvedCode | null;
};

type CodeRequestGroup = {
  code_name: string;
  region: "AU" | "UK" | "US";
  request_count: number;
  status_counts: Record<string, number>;
  most_recent: CodeRequest;
  requests: CodeRequest[];
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
  SUBMITTED: "bg-blue-100 text-blue-800",
  UNDER_REVIEW: "bg-yellow-100 text-yellow-800",
  IN_PROGRESS: "bg-purple-100 text-purple-800",
  PUBLISHED: "bg-green-100 text-green-800",
  DECLINED: "bg-red-100 text-red-800",
};

const STATUS_LABELS: Record<string, string> = {
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  IN_PROGRESS: "In Progress",
  PUBLISHED: "Published",
  DECLINED: "Declined",
};

export default function AdminCodeRequestsPage() {
  const [groups, setGroups] = useState<CodeRequestGroup[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selectedGroup, setSelectedGroup] = useState<CodeRequestGroup | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<CodeRequest | null>(null);

  const fetchGroups = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
        grouped: "true",
      });
      if (statusFilter) params.append("status", statusFilter);

      const response = await fetch(`/api/admin/code-requests?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch code requests");
      }

      const data = await response.json();
      setGroups(data.groups);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const handleGroupClick = (group: CodeRequestGroup) => {
    setSelectedGroup(group);
    setSelectedRequest(null);
  };

  const handleRequestClick = (request: CodeRequest) => {
    setSelectedRequest(request);
  };

  const handleCloseDetail = () => {
    setSelectedGroup(null);
    setSelectedRequest(null);
  };

  const handleRequestUpdate = async () => {
    // Refresh the list after an update
    fetchGroups();
    if (selectedGroup) {
      // Re-fetch the group data
      const params = new URLSearchParams({ grouped: "true" });
      const response = await fetch(`/api/admin/code-requests?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        const updatedGroup = data.groups.find(
          (g: CodeRequestGroup) =>
            g.code_name === selectedGroup.code_name && g.region === selectedGroup.region
        );
        if (updatedGroup) {
          setSelectedGroup(updatedGroup);
        }
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href="/admin" className="hover:text-gray-700">
              Admin
            </Link>
            <span>/</span>
            <span>Code Requests</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Code Requests</h1>
          <p className="text-gray-600 mt-1">
            Manage user requests for new building codes.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="PUBLISHED">Published</option>
              <option value="DECLINED">Declined</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-700">{error}</p>
          <button
            onClick={() => fetchGroups()}
            className="text-red-600 hover:text-red-800 text-sm mt-2 underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gray-200 rounded-lg" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
                  <div className="h-3 bg-gray-100 rounded w-1/4" />
                </div>
                <div className="w-12 h-8 bg-gray-200 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Content: Groups List + Detail Panel */}
      {!loading && !error && (
        <div className="flex gap-6">
          {/* Groups List */}
          <div className={`${selectedGroup ? "w-1/2" : "w-full"} transition-all duration-300`}>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              {groups.length === 0 ? (
                <div className="px-6 py-12 text-center">
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
                        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <p className="text-lg font-medium text-gray-600">
                      No code requests found
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      User code requests will appear here.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {groups.map((group) => (
                    <div
                      key={`${group.code_name}-${group.region}`}
                      className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                        selectedGroup?.code_name === group.code_name &&
                        selectedGroup?.region === group.region
                          ? "bg-blue-50 border-l-4 border-l-blue-500"
                          : ""
                      }`}
                      onClick={() => handleGroupClick(group)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-xl">
                            {REGION_FLAGS[group.region]}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">
                              {group.code_name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {REGION_NAMES[group.region]}
                            </div>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {Object.entries(group.status_counts).map(
                                ([status, count]) => (
                                  <span
                                    key={status}
                                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[status]}`}
                                  >
                                    {count} {STATUS_LABELS[status]}
                                  </span>
                                )
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-gray-900">
                              {group.request_count}
                            </div>
                            <div className="text-xs text-gray-500">
                              {group.request_count === 1 ? "request" : "requests"}
                            </div>
                          </div>
                          <svg
                            className="w-5 h-5 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {pagination && pagination.total_pages > 1 && (
                <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
                    {pagination.total} groups
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => fetchGroups(pagination.page - 1)}
                      disabled={pagination.page === 1}
                      className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => fetchGroups(pagination.page + 1)}
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

          {/* Detail Panel */}
          {selectedGroup && (
            <div className="w-1/2">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 sticky top-6">
                {/* Header */}
                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      {selectedGroup.code_name}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {REGION_FLAGS[selectedGroup.region]}{" "}
                      {REGION_NAMES[selectedGroup.region]} &bull;{" "}
                      {selectedGroup.request_count}{" "}
                      {selectedGroup.request_count === 1 ? "request" : "requests"}
                    </p>
                  </div>
                  <button
                    onClick={handleCloseDetail}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                {/* Request List or Detail */}
                {selectedRequest ? (
                  <RequestDetail
                    request={selectedRequest}
                    onBack={() => setSelectedRequest(null)}
                    onUpdate={handleRequestUpdate}
                  />
                ) : (
                  <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
                    {selectedGroup.requests.map((request) => (
                      <div
                        key={request.id}
                        className="p-4 hover:bg-gray-50 cursor-pointer"
                        onClick={() => handleRequestClick(request)}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                                  STATUS_COLORS[request.status]
                                }`}
                              >
                                {STATUS_LABELS[request.status]}
                              </span>
                              <span className="text-sm text-gray-500">
                                {new Date(request.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="text-sm text-gray-600 mt-1">
                              {request.user.name || request.user.email}
                            </div>
                            {request.description && (
                              <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                                {request.description}
                              </p>
                            )}
                          </div>
                          <svg
                            className="w-5 h-5 text-gray-400 flex-shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Request Detail Component
function RequestDetail({
  request,
  onBack,
  onUpdate,
}: {
  request: CodeRequest;
  onBack: () => void;
  onUpdate: () => void;
}) {
  const [status, setStatus] = useState(request.status);
  const [adminNotes, setAdminNotes] = useState(request.admin_notes || "");
  const [resolvedCodeId, setResolvedCodeId] = useState(request.resolved_code_id || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buildingCodes, setBuildingCodes] = useState<ResolvedCode[]>([]);
  const [loadingCodes, setLoadingCodes] = useState(true);

  // Fetch available building codes for linking
  useEffect(() => {
    const fetchCodes = async () => {
      try {
        const response = await fetch(`/api/admin/codes?status=ACTIVE&limit=100`);
        if (response.ok) {
          const data = await response.json();
          setBuildingCodes(data.codes);
        }
      } catch {
        // Ignore errors, just don't show codes
      } finally {
        setLoadingCodes(false);
      }
    };
    fetchCodes();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/code-requests/${request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          admin_notes: adminNotes || null,
          resolved_code_id: resolvedCodeId || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to update request");
      }

      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {/* Back button */}
      <div className="p-4 border-b border-gray-200">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
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
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to list
        </button>
      </div>

      {/* Request Details */}
      <div className="p-4 space-y-4 max-h-[550px] overflow-y-auto">
        {/* User Info */}
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
            Requested by
          </div>
          <div className="text-sm font-medium text-gray-900">
            {request.user.name || "No name"}
          </div>
          <div className="text-sm text-gray-500">{request.user.email}</div>
        </div>

        {/* Date Info */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
              Submitted
            </div>
            <div className="text-sm text-gray-900">
              {new Date(request.created_at).toLocaleDateString()} at{" "}
              {new Date(request.created_at).toLocaleTimeString()}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
              Last Updated
            </div>
            <div className="text-sm text-gray-900">
              {new Date(request.updated_at).toLocaleDateString()} at{" "}
              {new Date(request.updated_at).toLocaleTimeString()}
            </div>
          </div>
        </div>

        {/* Description */}
        {request.description && (
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
              Description
            </div>
            <p className="text-sm text-gray-900">{request.description}</p>
          </div>
        )}

        {/* Reference URL */}
        {request.reference_url && (
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
              Reference URL
            </div>
            <a
              href={request.reference_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-800 underline break-all"
            >
              {request.reference_url}
            </a>
          </div>
        )}

        <hr className="border-gray-200" />

        {/* Editable Fields */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Status */}
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
            Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as CodeRequest["status"])}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          >
            <option value="SUBMITTED">Submitted</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="PUBLISHED">Published</option>
            <option value="DECLINED">Declined</option>
          </select>
        </div>

        {/* Resolved Code */}
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
            Link to Building Code
          </label>
          {loadingCodes ? (
            <div className="h-10 bg-gray-100 animate-pulse rounded-lg" />
          ) : (
            <select
              value={resolvedCodeId}
              onChange={(e) => setResolvedCodeId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="">Not linked</option>
              {buildingCodes.map((code) => (
                <option key={code.id} value={code.id}>
                  {code.name} ({code.code_id})
                </option>
              ))}
            </select>
          )}
          <p className="text-xs text-gray-500 mt-1">
            Link this request to an existing building code when published.
          </p>
        </div>

        {/* Current Linked Code */}
        {request.resolvedCode && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="text-xs font-medium text-green-700 uppercase tracking-wider mb-1">
              Currently Linked To
            </div>
            <Link
              href={`/admin/codes/${request.resolvedCode.id}`}
              className="text-sm font-medium text-green-800 hover:text-green-900 underline"
            >
              {request.resolvedCode.name} ({request.resolvedCode.code_id})
            </Link>
          </div>
        )}

        {/* Admin Notes */}
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
            Admin Notes
          </label>
          <textarea
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            placeholder="Internal notes about this request..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-none"
            rows={3}
            maxLength={2000}
          />
        </div>
      </div>

      {/* Save Button */}
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {saving && (
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
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
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          )}
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
