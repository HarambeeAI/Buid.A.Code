"use client";

import { useState, useEffect, useCallback } from "react";
import { CodeRequestModal } from "@/components/code-requests";

type Region = {
  code: string;
  name: string;
  flag: string;
  flag_url: string;
};

type BuildingCode = {
  id: string;
  code_id: string;
  name: string;
  description: string | null;
  version: string;
  published_at: string | null;
  requirement_count: number;
};

type CodeRequest = {
  id: string;
  code_name: string;
  region: string;
  description: string | null;
  reference_url: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  resolvedCode: {
    id: string;
    code_id: string;
    name: string;
  } | null;
};

function StatusChip({ status }: { status: string }) {
  const styles: Record<string, string> = {
    SUBMITTED: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    UNDER_REVIEW: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    IN_PROGRESS: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    PUBLISHED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    DECLINED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };

  const labels: Record<string, string> = {
    SUBMITTED: "Submitted",
    UNDER_REVIEW: "Under Review",
    IN_PROGRESS: "In Progress",
    PUBLISHED: "Published",
    DECLINED: "Declined",
  };

  const style = styles[status] || "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
  const label = labels[status] || status;

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style}`}>
      {label}
    </span>
  );
}

function RegionFlag({ region, regions }: { region: string; regions: Region[] }) {
  const regionData = regions.find((r) => r.code === region);
  if (!regionData) return <span className="text-gray-400">{region}</span>;

  return (
    <span className="inline-flex items-center gap-1">
      <span>{regionData.flag}</span>
      <span className="text-gray-500 dark:text-gray-400">{regionData.name}</span>
    </span>
  );
}

export default function CodesPage() {
  const [activeTab, setActiveTab] = useState<"codes" | "requests">("codes");
  const [regions, setRegions] = useState<Region[]>([]);
  const [codesByRegion, setCodesByRegion] = useState<Record<string, BuildingCode[]>>({});
  const [requests, setRequests] = useState<CodeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch regions
      const regionsRes = await fetch("/api/regions");
      if (!regionsRes.ok) throw new Error("Failed to fetch regions");
      const regionsData = await regionsRes.json();
      setRegions(regionsData.regions);

      // Fetch codes for each region
      const codesMap: Record<string, BuildingCode[]> = {};
      await Promise.all(
        regionsData.regions.map(async (region: Region) => {
          const codesRes = await fetch(`/api/regions/${region.code}/codes`);
          if (codesRes.ok) {
            const codesData = await codesRes.json();
            codesMap[region.code] = codesData.codes;
          }
        })
      );
      setCodesByRegion(codesMap);

      // Fetch user's code requests
      const requestsRes = await fetch("/api/code-requests");
      if (requestsRes.ok) {
        const requestsData = await requestsRes.json();
        setRequests(requestsData.code_requests);
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRequestSuccess = () => {
    // Refresh requests list
    fetch("/api/code-requests")
      .then((res) => res.json())
      .then((data) => setRequests(data.code_requests))
      .catch(console.error);
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 bg-gray-200 dark:bg-gray-800 rounded" />
        <div className="h-12 w-64 bg-gray-200 dark:bg-gray-800 rounded" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-gray-200 dark:bg-gray-800 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
        <button
          onClick={fetchData}
          className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Supported Codes
        </h1>
        <button
          onClick={() => setIsRequestModalOpen(true)}
          className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Request a Code
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="-mb-px flex gap-6">
          <button
            onClick={() => setActiveTab("codes")}
            className={`py-3 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "codes"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            }`}
          >
            Available Codes
          </button>
          <button
            onClick={() => setActiveTab("requests")}
            className={`py-3 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "requests"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            }`}
          >
            My Requests
            {requests.length > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full text-xs">
                {requests.length}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Available Codes Tab */}
      {activeTab === "codes" && (
        <div className="space-y-8">
          {regions.map((region) => {
            const codes = codesByRegion[region.code] || [];
            if (codes.length === 0) return null;

            return (
              <div key={region.code}>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl">{region.flag}</span>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {region.name}
                  </h2>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    ({codes.length} code{codes.length !== 1 ? "s" : ""})
                  </span>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {codes.map((code) => (
                    <div
                      key={code.id}
                      className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-medium text-gray-900 dark:text-white">
                          {code.name}
                        </h3>
                        <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                          {code.version}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                        {code.code_id}
                      </p>
                      {code.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
                          {code.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>
                          {code.requirement_count} requirement{code.requirement_count !== 1 ? "s" : ""}
                        </span>
                        {code.published_at && (
                          <span>
                            Published {new Date(code.published_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {Object.values(codesByRegion).every((codes) => codes.length === 0) && (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No Codes Available
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                No building codes have been published yet.
              </p>
              <button
                onClick={() => setIsRequestModalOpen(true)}
                className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Request a Code
              </button>
            </div>
          )}
        </div>
      )}

      {/* My Requests Tab */}
      {activeTab === "requests" && (
        <div>
          {requests.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2m-4-1v8m0 0l3-3m-3 3L9 8m-5 5h2.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293h3.172a1 1 0 00.707-.293l2.414-2.414a1 1 0 01.707-.293H20" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No Requests Yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                You haven&apos;t requested any building codes yet.
              </p>
              <button
                onClick={() => setIsRequestModalOpen(true)}
                className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Request a Code
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {request.code_name}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        <RegionFlag region={request.region} regions={regions} />
                      </p>
                    </div>
                    <StatusChip status={request.status} />
                  </div>

                  {request.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      {request.description}
                    </p>
                  )}

                  {request.reference_url && (
                    <a
                      href={request.reference_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 inline-flex items-center gap-1 mb-3"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Reference Link
                    </a>
                  )}

                  {request.admin_notes && (
                    <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Admin Notes
                      </p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {request.admin_notes}
                      </p>
                    </div>
                  )}

                  {request.resolvedCode && (
                    <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                      <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-1">
                        Code Published
                      </p>
                      <p className="text-sm text-green-800 dark:text-green-300">
                        {request.resolvedCode.name} ({request.resolvedCode.code_id})
                      </p>
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>
                      Requested {new Date(request.created_at).toLocaleDateString()}
                    </span>
                    {request.updated_at !== request.created_at && (
                      <span>
                        Updated {new Date(request.updated_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Code Request Modal */}
      <CodeRequestModal
        isOpen={isRequestModalOpen}
        onClose={() => {
          setIsRequestModalOpen(false);
          handleRequestSuccess();
        }}
        regions={regions}
      />
    </div>
  );
}
