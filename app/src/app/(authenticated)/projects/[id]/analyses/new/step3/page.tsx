"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

type User = {
  id: string;
  email: string;
  name: string | null;
  tier: "FREE" | "PRO";
  analyses_remaining: number | null;
  role: "USER" | "ADMIN";
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

type Region = {
  code: string;
  name: string;
  flag: string;
  flag_url: string;
};

type WizardData = {
  // Step 1
  fileKey: string | null;
  documentType: "PDF" | "PNG" | "JPG" | "TIFF" | null;
  pageCount: number;
  description: string;
  pageNumbers: string;
  // Step 2
  region: string | null;
  selectedCodes: string[];
};

const REGION_NAMES: Record<string, { name: string; flag: string }> = {
  AU: { name: "Australia", flag: "🇦🇺" },
  UK: { name: "United Kingdom", flag: "🇬🇧" },
  US: { name: "United States", flag: "🇺🇸" },
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileTypeIcon({ type }: { type: WizardData["documentType"] }) {
  const iconClasses = "w-8 h-8";

  switch (type) {
    case "PDF":
      return (
        <div className="w-12 h-12 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
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
        <div className="w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
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
    default:
      return (
        <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
          <svg
            className={`${iconClasses} text-gray-400`}
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

function SummarySection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800">
        <h3 className="font-medium text-gray-900 dark:text-white">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export default function AnalysisWizardStep3() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [wizardData, setWizardData] = useState<WizardData | null>(null);
  const [codes, setCodes] = useState<BuildingCode[]>([]);
  const [loadingCodes, setLoadingCodes] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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
      // No previous data, redirect back to step 1
      router.replace(`/projects/${projectId}/analyses/new`);
      return;
    }

    try {
      const data = JSON.parse(stored) as WizardData;
      // Verify we have step 2 data
      if (!data.region || !data.selectedCodes || data.selectedCodes.length === 0) {
        router.replace(`/projects/${projectId}/analyses/new/step2`);
        return;
      }
      setWizardData(data);
    } catch {
      router.replace(`/projects/${projectId}/analyses/new`);
    }
  }, [projectId, router]);

  // Fetch codes for the selected region
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
    if (wizardData?.region) {
      fetchCodes(wizardData.region);
    }
  }, [wizardData?.region, fetchCodes]);

  const handleBack = () => {
    // wizard data is already saved in sessionStorage
    router.push(`/projects/${projectId}/analyses/new/step2`);
  };

  const handleSubmit = async () => {
    if (!wizardData || !user) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      // Construct the document URL from the file key
      const bucketUrl = process.env.NEXT_PUBLIC_BUCKET_URL || "";
      const documentUrl = wizardData.fileKey
        ? `${bucketUrl}/${wizardData.fileKey}`
        : "";

      // Get filename from fileKey (format: userId/timestamp_filename)
      const fileKeyParts = wizardData.fileKey?.split("/") || [];
      const documentName =
        fileKeyParts.length > 1
          ? fileKeyParts[fileKeyParts.length - 1].replace(/^\d+_/, "")
          : "Untitled Document";

      const res = await fetch(`/api/projects/${projectId}/analyses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document_name: documentName,
          document_url: documentUrl || `file://${wizardData.fileKey}`,
          document_size: 0, // We don't have this info in wizard data
          document_type: wizardData.documentType,
          page_count: wizardData.pageCount,
          description: wizardData.description || null,
          page_numbers: wizardData.pageNumbers || null,
          region: wizardData.region,
          selected_codes: wizardData.selectedCodes,
        }),
      });

      if (!res.ok) {
        const data = await res.json();

        // Handle specific 403 errors
        if (res.status === 403) {
          const code = data.code;
          if (code === "PAGE_LIMIT_EXCEEDED") {
            setSubmitError(
              `Page limit exceeded. Free tier allows up to ${data.limit} pages.`
            );
          } else if (code === "CODE_LIMIT_EXCEEDED") {
            setSubmitError(
              `Code limit exceeded. Free tier allows up to ${data.limit} codes.`
            );
          } else if (code === "ANALYSES_EXHAUSTED") {
            setSubmitError(
              "You have used all your free analyses. Upgrade to Pro for unlimited analyses."
            );
          } else {
            setSubmitError(data.message || "Access denied");
          }
          return;
        }

        throw new Error(data.message || "Failed to create analysis");
      }

      const analysis = await res.json();

      // Clear wizard data
      sessionStorage.removeItem(`wizard_${projectId}`);

      // Redirect to processing page
      router.push(`/projects/${projectId}/analyses/${analysis.id}/processing`);
    } catch (err) {
      console.error("Submit error:", err);
      setSubmitError(
        err instanceof Error ? err.message : "Failed to create analysis"
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Get selected code details
  const selectedCodeDetails = codes.filter((c) =>
    wizardData?.selectedCodes.includes(c.id)
  );

  // Calculate total requirements
  const totalRequirements = selectedCodeDetails.reduce(
    (sum, c) => sum + c.requirement_count,
    0
  );

  // Estimate processing time (rough estimate: ~2-5 seconds per requirement-page pair)
  const estimatedMinutes = Math.max(
    1,
    Math.ceil((totalRequirements * (wizardData?.pageCount || 1) * 3) / 60)
  );
  const estimatedTimeText =
    estimatedMinutes <= 1
      ? "Less than a minute"
      : estimatedMinutes <= 5
      ? `${estimatedMinutes} minutes`
      : "Several minutes";

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
          <p className="text-red-600 dark:text-red-400 mb-4">
            {error || "Failed to load data"}
          </p>
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

  const regionInfo = wizardData.region
    ? REGION_NAMES[wizardData.region] || { name: wizardData.region, flag: "" }
    : null;

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
                <svg
                  className="w-5 h-5"
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
              </Link>
              <div>
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                  New Analysis
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Step 3 of 3: Review &amp; Submit
                </p>
              </div>
            </div>

            {/* Step indicators */}
            <div className="hidden sm:flex items-center gap-2">
              <div className="flex items-center">
                <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center text-sm font-medium">
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
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <div className="w-12 h-0.5 bg-green-600 ml-2" />
              </div>
              <div className="flex items-center">
                <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center text-sm font-medium">
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
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <div className="w-12 h-0.5 bg-green-600 ml-2" />
              </div>
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-medium">
                3
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Review Your Analysis
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Please review your selections before submitting.
            </p>
          </div>

          {/* Document Summary */}
          <SummarySection title="Document">
            <div className="flex items-start gap-4">
              <FileTypeIcon type={wizardData.documentType} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded">
                    {wizardData.documentType}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {wizardData.pageCount}{" "}
                    {wizardData.pageCount === 1 ? "page" : "pages"}
                  </span>
                </div>
                {wizardData.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    {wizardData.description}
                  </p>
                )}
                {wizardData.pageNumbers && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Analyzing pages: {wizardData.pageNumbers}
                  </p>
                )}
              </div>
              <button
                onClick={() => router.push(`/projects/${projectId}/analyses/new`)}
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Edit
              </button>
            </div>
          </SummarySection>

          {/* Region & Codes Summary */}
          <SummarySection title="Building Codes">
            <div className="space-y-4">
              {/* Region */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{regionInfo?.flag}</span>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {regionInfo?.name}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Region
                    </p>
                  </div>
                </div>
                <button
                  onClick={() =>
                    router.push(`/projects/${projectId}/analyses/new/step2`)
                  }
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Edit
                </button>
              </div>

              {/* Selected Codes */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  {wizardData.selectedCodes.length}{" "}
                  {wizardData.selectedCodes.length === 1
                    ? "code"
                    : "codes"}{" "}
                  selected
                </p>

                {loadingCodes ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedCodeDetails.map((code) => (
                      <div
                        key={code.id}
                        className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {code.name}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {code.code_id} • {code.requirement_count} requirements
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      Total requirements to check
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {totalRequirements}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </SummarySection>

          {/* Estimate */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
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
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <p className="font-medium text-blue-900 dark:text-blue-200">
                  Estimated processing time
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  {estimatedTimeText} • {wizardData.pageCount}{" "}
                  {wizardData.pageCount === 1 ? "page" : "pages"} ×{" "}
                  {totalRequirements} requirements
                </p>
              </div>
            </div>
          </div>

          {/* Error message */}
          {submitError && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-start gap-3">
                <svg
                  className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div>
                  <p className="text-sm font-medium text-red-800 dark:text-red-200">
                    Unable to start analysis
                  </p>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                    {submitError}
                  </p>
                  {submitError.includes("Upgrade") && (
                    <Link
                      href="/settings/upgrade"
                      className="inline-flex items-center mt-2 text-sm font-medium text-red-700 dark:text-red-300 hover:text-red-800 dark:hover:text-red-200"
                    >
                      Upgrade to Pro
                      <svg
                        className="w-4 h-4 ml-1"
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
                    </Link>
                  )}
                </div>
              </div>
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
              disabled={submitting}
              className="flex items-center text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors disabled:opacity-50"
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
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back
            </button>

            <div className="flex items-center gap-4">
              {/* Tier context for FREE users */}
              {user.tier === "FREE" && user.analyses_remaining !== null && (
                <span className="text-sm text-gray-500 dark:text-gray-400 hidden sm:block">
                  {user.analyses_remaining} of 2 free analyses remaining
                </span>
              )}

              <button
                onClick={handleSubmit}
                disabled={submitting}
                className={`
                  inline-flex items-center px-6 py-2.5 rounded-lg font-medium transition-colors
                  ${
                    submitting
                      ? "bg-blue-400 dark:bg-blue-700 text-white cursor-wait"
                      : "bg-blue-600 hover:bg-blue-700 text-white"
                  }
                `}
              >
                {submitting ? (
                  <>
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
                    Starting Analysis...
                  </>
                ) : (
                  <>
                    Start Analysis
                    <svg
                      className="w-5 h-5 ml-2"
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
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
