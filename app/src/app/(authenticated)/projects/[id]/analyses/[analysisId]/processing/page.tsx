"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

type AnalysisStatus =
  | "PENDING"
  | "CLASSIFYING"
  | "ANALYSING"
  | "VALIDATING"
  | "GENERATING"
  | "COMPLETED"
  | "FAILED";

type StatusResponse = {
  status: AnalysisStatus;
  current_stage: string | null;
  compliance_score: number | null;
  overall_status: "PASS" | "CONDITIONAL" | "FAIL" | null;
  total_checks: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

type TimelineStep = {
  id: AnalysisStatus;
  label: string;
  description: string;
};

const TIMELINE_STEPS: TimelineStep[] = [
  { id: "PENDING", label: "Uploading", description: "Preparing your document" },
  { id: "CLASSIFYING", label: "Classifying", description: "Identifying page types" },
  { id: "ANALYSING", label: "Analysing", description: "Checking compliance requirements" },
  { id: "VALIDATING", label: "Validating", description: "Cross-referencing findings" },
  { id: "GENERATING", label: "Generating", description: "Creating your report" },
];

const STATUS_ORDER: Record<AnalysisStatus, number> = {
  PENDING: 0,
  CLASSIFYING: 1,
  ANALYSING: 2,
  VALIDATING: 3,
  GENERATING: 4,
  COMPLETED: 5,
  FAILED: -1,
};

function formatElapsedTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

function StepIcon({ status, isActive, isFailed }: {
  status: "complete" | "active" | "pending";
  isActive: boolean;
  isFailed: boolean;
}) {
  if (isFailed) {
    return (
      <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
        <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
    );
  }

  if (status === "complete") {
    return (
      <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center">
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
    );
  }

  if (status === "active" || isActive) {
    return (
      <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
        <svg className="w-5 h-5 text-white animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
      <div className="w-3 h-3 rounded-full bg-gray-400 dark:bg-gray-500" />
    </div>
  );
}

export default function ProcessingPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const analysisId = params.analysisId as string;

  const [statusData, setStatusData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  // Elapsed time tracking
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const startTimeRef = useRef<Date | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/analyses/${analysisId}/status`);

      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = "/api/auth/login";
          return;
        }
        if (res.status === 404) {
          setError("Analysis not found");
          return;
        }
        throw new Error("Failed to fetch status");
      }

      const data: StatusResponse = await res.json();
      setStatusData(data);
      setError(null);

      // Set start time on first load
      if (!startTimeRef.current && data.started_at) {
        startTimeRef.current = new Date(data.started_at);
      } else if (!startTimeRef.current) {
        startTimeRef.current = new Date(data.created_at);
      }

      // Handle completion - redirect to report
      if (data.status === "COMPLETED") {
        // Small delay to show completion state
        setTimeout(() => {
          router.push(`/projects/${projectId}/analyses/${analysisId}/report`);
        }, 1500);
      }
    } catch (err) {
      console.error("Error fetching status:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [analysisId, projectId, router]);

  // Initial fetch
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Polling every 5 seconds
  useEffect(() => {
    if (!statusData || statusData.status === "COMPLETED" || statusData.status === "FAILED") {
      return;
    }

    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [statusData, fetchStatus]);

  // Elapsed time counter
  useEffect(() => {
    if (!startTimeRef.current || statusData?.status === "COMPLETED" || statusData?.status === "FAILED") {
      return;
    }

    const updateElapsed = () => {
      if (startTimeRef.current) {
        const now = new Date();
        const elapsed = Math.floor((now.getTime() - startTimeRef.current.getTime()) / 1000);
        setElapsedSeconds(elapsed);
      }
    };

    updateElapsed();
    timerRef.current = setInterval(updateElapsed, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [statusData?.status]);

  // Handle retry
  const handleRetry = async () => {
    setRetrying(true);
    // For now, we'll just refetch status
    // In the future, this could trigger a re-queue of the analysis
    await fetchStatus();
    setRetrying(false);
  };

  // Determine step states
  const getStepStatus = (stepId: AnalysisStatus): "complete" | "active" | "pending" => {
    if (!statusData) return "pending";

    const currentOrder = STATUS_ORDER[statusData.status];
    const stepOrder = STATUS_ORDER[stepId];

    if (statusData.status === "FAILED") {
      // Mark all previous steps as complete, current step where it failed
      if (stepOrder < currentOrder) return "complete";
      if (stepId === statusData.current_stage) return "active";
      return "pending";
    }

    if (statusData.status === "COMPLETED") {
      return "complete";
    }

    if (stepOrder < currentOrder) return "complete";
    if (stepOrder === currentOrder) return "active";
    return "pending";
  };

  // Get current stage description for analysing step
  const getAnalysingDescription = () => {
    if (!statusData || statusData.status !== "ANALYSING") {
      return "Checking compliance requirements";
    }
    if (statusData.current_stage) {
      return statusData.current_stage;
    }
    if (statusData.total_checks > 0) {
      return `Checking ${statusData.total_checks} requirements`;
    }
    return "Checking compliance requirements";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (error && !statusData) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Something went wrong</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <Link
            href={`/projects/${projectId}`}
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Back to Project
          </Link>
        </div>
      </div>
    );
  }

  const isFailed = statusData?.status === "FAILED";
  const isCompleted = statusData?.status === "COMPLETED";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link
              href={`/projects/${projectId}`}
              className="flex items-center text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Project
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Title and elapsed time */}
        <div className="text-center mb-12">
          {isFailed ? (
            <>
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <svg className="w-10 h-10 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Analysis Failed
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Something went wrong during processing. Please try again.
              </p>
            </>
          ) : isCompleted ? (
            <>
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <svg className="w-10 h-10 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Analysis Complete!
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Redirecting to your report...
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Analyzing Your Document
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Please wait while we check compliance requirements
              </p>
              {elapsedSeconds > 0 && (
                <p className="mt-3 text-sm font-medium text-blue-600 dark:text-blue-400">
                  Elapsed: {formatElapsedTime(elapsedSeconds)}
                </p>
              )}
            </>
          )}
        </div>

        {/* Timeline */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 sm:p-8">
          <div className="space-y-0">
            {TIMELINE_STEPS.map((step, index) => {
              const stepStatus = getStepStatus(step.id);
              const isActive = stepStatus === "active";
              const isStepFailed = isFailed && statusData?.current_stage === step.id;
              const isLastStep = index === TIMELINE_STEPS.length - 1;

              // Get description - special case for ANALYSING
              const description = step.id === "ANALYSING" ? getAnalysingDescription() : step.description;

              return (
                <div key={step.id} className="relative">
                  <div className="flex items-start gap-4">
                    <div className="flex flex-col items-center">
                      <StepIcon
                        status={stepStatus}
                        isActive={isActive}
                        isFailed={isStepFailed}
                      />
                      {!isLastStep && (
                        <div
                          className={`w-0.5 h-12 mt-2 ${
                            stepStatus === "complete"
                              ? "bg-green-600"
                              : "bg-gray-200 dark:bg-gray-700"
                          }`}
                        />
                      )}
                    </div>
                    <div className={`flex-1 pb-${isLastStep ? '0' : '8'}`}>
                      <h3
                        className={`font-semibold ${
                          isActive
                            ? "text-blue-600 dark:text-blue-400"
                            : stepStatus === "complete"
                            ? "text-gray-900 dark:text-white"
                            : "text-gray-400 dark:text-gray-500"
                        }`}
                      >
                        {step.label}
                        {isActive && (
                          <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                            In progress...
                          </span>
                        )}
                      </h3>
                      <p
                        className={`text-sm mt-0.5 ${
                          stepStatus === "pending" && !isStepFailed
                            ? "text-gray-400 dark:text-gray-500"
                            : "text-gray-600 dark:text-gray-400"
                        }`}
                      >
                        {description}
                      </p>
                      {isStepFailed && (
                        <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                          Failed at this step
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Error state actions */}
        {isFailed && (
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {retrying ? (
                <>
                  <svg className="animate-spin w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Retrying...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Try Again
                </>
              )}
            </button>
            <Link
              href={`/projects/${projectId}`}
              className="inline-flex items-center justify-center px-6 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-medium transition-colors"
            >
              Back to Project
            </Link>
          </div>
        )}

        {/* Completed state - manual link in case redirect doesn't work */}
        {isCompleted && (
          <div className="mt-8 text-center">
            <Link
              href={`/projects/${projectId}/analyses/${analysisId}/report`}
              className="inline-flex items-center text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
            >
              View Report
              <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
