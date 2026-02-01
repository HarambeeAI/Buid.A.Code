"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CodeRequestModal } from "@/components/code-requests";

type User = {
  id: string;
  email: string;
  name: string | null;
  tier: "FREE" | "PRO";
  analyses_remaining: number | null;
  role: "USER" | "ADMIN";
};

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

type WizardData = {
  fileKey: string | null;
  documentType: "PDF" | "PNG" | "JPG" | "TIFF" | null;
  pageCount: number;
  description: string;
  pageNumbers: string;
  // Step 2 additions
  region: string | null;
  selectedCodes: string[];
};

const MAX_CODES = {
  FREE: 3,
  PRO: Infinity,
};

function RegionCard({
  region,
  isSelected,
  onSelect,
}: {
  region: Region;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`
        relative p-4 rounded-xl border-2 transition-all text-left w-full
        ${isSelected
          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
          : "border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-gray-50 dark:hover:bg-gray-800/50"
        }
      `}
    >
      {isSelected && (
        <div className="absolute top-3 right-3">
          <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
      )}
      <div className="text-3xl mb-2">{region.flag}</div>
      <div className="font-medium text-gray-900 dark:text-white">{region.name}</div>
      <div className="text-sm text-gray-500 dark:text-gray-400">{region.code}</div>
    </button>
  );
}

function CodeCard({
  code,
  isSelected,
  isLocked,
  onToggle,
  isRecommended,
}: {
  code: BuildingCode;
  isSelected: boolean;
  isLocked: boolean;
  onToggle: () => void;
  isRecommended: boolean;
}) {
  return (
    <div
      className={`
        relative p-4 rounded-xl border transition-all
        ${isSelected
          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
          : isLocked
          ? "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 opacity-75"
          : "border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700"
        }
      `}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={onToggle}
          disabled={isLocked && !isSelected}
          className={`
            flex-shrink-0 w-5 h-5 mt-0.5 rounded border-2 transition-colors flex items-center justify-center
            ${isSelected
              ? "border-blue-600 bg-blue-600"
              : isLocked
              ? "border-gray-300 dark:border-gray-600 cursor-not-allowed"
              : "border-gray-300 dark:border-gray-600 hover:border-blue-500"
            }
          `}
        >
          {isSelected && (
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium text-gray-900 dark:text-white">
              {code.name}
            </h3>
            {isRecommended && (
              <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full">
                Recommended
              </span>
            )}
            {isLocked && !isSelected && (
              <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-full flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Pro
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {code.code_id} {code.version && `v${code.version}`}
          </p>
          {code.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 line-clamp-2">
              {code.description}
            </p>
          )}
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            {code.requirement_count} requirements
          </p>
        </div>
      </div>

      {/* Locked tooltip */}
      {isLocked && !isSelected && (
        <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Free tier limited to 3 codes. Upgrade for unlimited codes.
          </p>
        </div>
      )}
    </div>
  );
}

export default function AnalysisWizardStep2() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [regions, setRegions] = useState<Region[]>([]);
  const [codes, setCodes] = useState<BuildingCode[]>([]);
  const [loadingCodes, setLoadingCodes] = useState(false);

  const [wizardData, setWizardData] = useState<WizardData | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);

  const [showCodeRequestModal, setShowCodeRequestModal] = useState(false);

  // Fetch user data
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          if (res.status === 401) {
            window.location.href = "/api/auth/login";
            return;
          }
          throw new Error("Failed to fetch user");
        }
        const userData = await res.json();
        setUser(userData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  // Load wizard data from sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem(`wizard_${projectId}`);
    if (!stored) {
      // No step 1 data, redirect back
      router.replace(`/projects/${projectId}/analyses/new`);
      return;
    }

    try {
      const data = JSON.parse(stored);
      setWizardData(data);
      // Restore previous selections if any
      if (data.region) {
        setSelectedRegion(data.region);
      }
      if (data.selectedCodes && data.selectedCodes.length > 0) {
        setSelectedCodes(data.selectedCodes);
      }
    } catch {
      router.replace(`/projects/${projectId}/analyses/new`);
    }
  }, [projectId, router]);

  // Fetch regions
  useEffect(() => {
    const fetchRegions = async () => {
      try {
        const res = await fetch("/api/regions");
        if (!res.ok) throw new Error("Failed to fetch regions");
        const data = await res.json();
        setRegions(data.regions);
      } catch (err) {
        console.error("Error fetching regions:", err);
      }
    };

    fetchRegions();
  }, []);

  // Fetch codes when region changes
  const fetchCodes = useCallback(async (region: string) => {
    setLoadingCodes(true);
    try {
      const res = await fetch(`/api/regions/${region}/codes`);
      if (!res.ok) throw new Error("Failed to fetch codes");
      const data = await res.json();
      setCodes(data.codes);
    } catch (err) {
      console.error("Error fetching codes:", err);
      setCodes([]);
    } finally {
      setLoadingCodes(false);
    }
  }, []);

  useEffect(() => {
    if (selectedRegion) {
      fetchCodes(selectedRegion);
      // Clear codes when region changes (unless restoring from session)
      if (wizardData?.region !== selectedRegion) {
        setSelectedCodes([]);
      }
    }
  }, [selectedRegion, fetchCodes, wizardData?.region]);

  const handleRegionSelect = (regionCode: string) => {
    setSelectedRegion(regionCode);
  };

  const handleCodeToggle = (codeId: string) => {
    if (!user) return;

    const maxCodes = MAX_CODES[user.tier];
    const isCurrentlySelected = selectedCodes.includes(codeId);

    if (isCurrentlySelected) {
      // Always allow deselection
      setSelectedCodes(selectedCodes.filter((id) => id !== codeId));
    } else {
      // Check if at limit
      if (selectedCodes.length >= maxCodes) {
        // Can't select more
        return;
      }
      setSelectedCodes([...selectedCodes, codeId]);
    }
  };

  const handleBack = () => {
    // Save current selections before going back
    if (wizardData) {
      sessionStorage.setItem(
        `wizard_${projectId}`,
        JSON.stringify({
          ...wizardData,
          region: selectedRegion,
          selectedCodes,
        })
      );
    }
    router.push(`/projects/${projectId}/analyses/new`);
  };

  const handleNext = () => {
    if (!wizardData) return;

    // Save step 2 data
    sessionStorage.setItem(
      `wizard_${projectId}`,
      JSON.stringify({
        ...wizardData,
        region: selectedRegion,
        selectedCodes,
      })
    );

    router.push(`/projects/${projectId}/analyses/new/step3`);
  };

  const isNextDisabled = !selectedRegion || selectedCodes.length === 0;

  // Determine which codes are recommended (ones with most requirements)
  const recommendedCodeIds = codes
    .slice()
    .sort((a, b) => b.requirement_count - a.requirement_count)
    .slice(0, 2)
    .map((c) => c.id);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !user || !wizardData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">{error || "Failed to load data"}</p>
          <Link
            href={`/projects/${projectId}`}
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            Back to project
          </Link>
        </div>
      </div>
    );
  }

  const maxCodes = MAX_CODES[user.tier];
  const atCodeLimit = user.tier === "FREE" && selectedCodes.length >= maxCodes;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link
                href={`/projects/${projectId}`}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Link>
              <div>
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                  New Analysis
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Step 2 of 3: Select Building Codes
                </p>
              </div>
            </div>

            {/* Step indicators */}
            <div className="hidden sm:flex items-center gap-2">
              <div className="flex items-center">
                <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center text-sm font-medium">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="w-12 h-0.5 bg-green-600 ml-2" />
              </div>
              <div className="flex items-center">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-medium">
                  2
                </div>
                <div className="w-12 h-0.5 bg-gray-200 dark:bg-gray-700 ml-2" />
              </div>
              <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-400 flex items-center justify-center text-sm font-medium">
                3
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
        <div className="space-y-8">
          {/* Region selection */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Select Region
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Choose the jurisdiction for your building plan.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {regions.map((region) => (
                <RegionCard
                  key={region.code}
                  region={region}
                  isSelected={selectedRegion === region.code}
                  onSelect={() => handleRegionSelect(region.code)}
                />
              ))}
            </div>
          </div>

          {/* Code selection */}
          {selectedRegion && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Select Building Codes
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">
                    Choose which codes to check your plan against.
                    {user.tier === "FREE" && (
                      <span className="ml-2 text-amber-600 dark:text-amber-400">
                        ({selectedCodes.length}/{maxCodes} selected)
                      </span>
                    )}
                  </p>
                </div>

                <button
                  onClick={() => setShowCodeRequestModal(true)}
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Don&apos;t see your code?
                </button>
              </div>

              {loadingCodes ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
                </div>
              ) : codes.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 mb-2">
                    No building codes available for this region yet.
                  </p>
                  <button
                    onClick={() => setShowCodeRequestModal(true)}
                    className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
                  >
                    Request a code
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {codes.map((code) => {
                    const isSelected = selectedCodes.includes(code.id);
                    const isLocked = atCodeLimit && !isSelected;

                    return (
                      <CodeCard
                        key={code.id}
                        code={code}
                        isSelected={isSelected}
                        isLocked={isLocked}
                        onToggle={() => handleCodeToggle(code.id)}
                        isRecommended={recommendedCodeIds.includes(code.id)}
                      />
                    );
                  })}
                </div>
              )}

              {/* Upgrade CTA for free users at limit */}
              {atCodeLimit && (
                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex items-start gap-3">
                    <svg
                      className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
                        Want to check more codes?
                      </p>
                      <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                        Upgrade to Pro for unlimited building code selection.
                      </p>
                      <Link
                        href="/settings/upgrade"
                        className="inline-flex items-center mt-2 text-sm font-medium text-blue-700 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-200"
                      >
                        Upgrade to Pro
                        <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={handleBack}
              className="flex items-center text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <button
              onClick={handleNext}
              disabled={isNextDisabled}
              className={`
                inline-flex items-center px-6 py-2.5 rounded-lg font-medium transition-colors
                ${isNextDisabled
                  ? "bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
                }
              `}
            >
              Next: Review
              <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Code Request Modal */}
      <CodeRequestModal
        isOpen={showCodeRequestModal}
        onClose={() => setShowCodeRequestModal(false)}
        regions={regions}
      />
    </div>
  );
}
