"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import ProjectModal from "@/components/projects/ProjectModal";

type User = {
  id: string;
  email: string;
  name: string | null;
  tier: "FREE" | "PRO";
  analyses_remaining: number | null;
  role: "USER" | "ADMIN";
};

type Analysis = {
  id: string;
  report_ref: string;
  document_name: string;
  document_type: string;
  status: string;
  compliance_score: number | null;
  overall_status: string | null;
  created_at: string;
  project: {
    id: string;
    name: string;
  };
};

type DashboardData = {
  user: User | null;
  recentAnalyses: Analysis[];
  projectCount: number;
};

function StatusChip({ status }: { status: string }) {
  const styles: Record<string, string> = {
    COMPLETED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    CLASSIFYING: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    ANALYSING: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    VALIDATING: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    GENERATING: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    FAILED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };

  const style = styles[status] || "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${style}`}>
      {status}
    </span>
  );
}

function OverallStatusChip({ status }: { status: string | null }) {
  if (!status) return null;

  const styles: Record<string, string> = {
    PASS: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    CONDITIONAL: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    FAIL: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };

  const style = styles[status] || "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${style}`}>
      {status}
    </span>
  );
}

function TierCard({ user }: { user: User }) {
  const isFree = user.tier === "FREE";

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Your Plan
        </h2>
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium ${
            isFree
              ? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
              : "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
          }`}
        >
          {user.tier}
        </span>
      </div>

      {isFree ? (
        <>
          <div className="mb-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Analyses remaining
            </p>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-gray-900 dark:text-white">
                {user.analyses_remaining ?? 0}
              </span>
              <span className="text-gray-500 dark:text-gray-400">of 2</span>
            </div>
            <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{
                  width: `${((user.analyses_remaining ?? 0) / 2) * 100}%`,
                }}
              />
            </div>
          </div>

          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400 mb-4">
            <p>Free tier limits:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Maximum 5 pages per document</li>
              <li>Maximum 3 building codes per analysis</li>
              <li>No PDF export</li>
            </ul>
          </div>

          <Link
            href="/settings/billing"
            className="block w-full text-center py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Upgrade to Pro
          </Link>
        </>
      ) : (
        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <p className="flex items-center gap-2">
            <svg
              className="w-4 h-4 text-green-500"
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
            Unlimited analyses
          </p>
          <p className="flex items-center gap-2">
            <svg
              className="w-4 h-4 text-green-500"
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
            Up to 50 pages per document
          </p>
          <p className="flex items-center gap-2">
            <svg
              className="w-4 h-4 text-green-500"
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
            PDF export included
          </p>
        </div>
      )}
    </div>
  );
}

function QuickActions({ onNewProject }: { onNewProject: () => void }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Quick Actions
      </h2>
      <div className="space-y-3">
        <button
          onClick={onNewProject}
          className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
        >
          <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-blue-600 dark:text-blue-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-white">
              New Project
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Create a new project to organize analyses
            </p>
          </div>
        </button>

        <Link
          href="/projects"
          className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-green-600 dark:text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-white">
              New Analysis
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Run a compliance check on your plans
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}

function RecentAnalyses({ analyses }: { analyses: Analysis[] }) {
  if (analyses.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Recent Analyses
        </h2>
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-gray-400"
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
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            No analyses yet
          </p>
          <Link
            href="/projects"
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Start Your First Analysis
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Recent Analyses
        </h2>
        <Link
          href="/projects"
          className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          View all
        </Link>
      </div>
      <div className="space-y-3">
        {analyses.map((analysis) => (
          <Link
            key={analysis.id}
            href={`/analyses/${analysis.id}`}
            className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  {analysis.document_type}
                </span>
              </div>
              <div className="min-w-0">
                <p className="font-medium text-gray-900 dark:text-white truncate">
                  {analysis.document_name}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {analysis.project.name} &middot; {analysis.report_ref}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-4">
              {analysis.status === "COMPLETED" ? (
                <>
                  {analysis.compliance_score !== null && (
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {analysis.compliance_score}%
                    </span>
                  )}
                  <OverallStatusChip status={analysis.overall_status} />
                </>
              ) : (
                <StatusChip status={analysis.status} />
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function EmptyDashboard({ onNewProject }: { onNewProject: () => void }) {
  return (
    <div className="text-center py-12">
      <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
        <svg
          className="w-12 h-12 text-blue-600 dark:text-blue-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
      </div>
      <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
        Welcome to Build.A.Code
      </h2>
      <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
        Your AI-powered building plan compliance platform. Upload architectural
        drawings and get professional compliance reports in minutes.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button
          onClick={onNewProject}
          className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
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
          Create Your First Project
        </button>
        <Link
          href="/codes"
          className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg font-medium transition-colors"
        >
          Browse Supported Codes
        </Link>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        // Fetch user data
        const userRes = await fetch("/api/auth/me");
        if (!userRes.ok) {
          if (userRes.status === 401) {
            window.location.href = "/api/auth/login";
            return;
          }
          throw new Error("Failed to fetch user");
        }
        const user = await userRes.json();

        // Fetch projects to count and get analyses
        const projectsRes = await fetch("/api/projects?limit=100");
        const projectsData = await projectsRes.json();

        // Collect recent analyses from all projects
        const allAnalyses: Analysis[] = [];
        if (projectsData.projects && projectsData.projects.length > 0) {
          // Fetch analyses from each project (just get recent ones)
          const analysisPromises = projectsData.projects
            .slice(0, 10)
            .map(async (project: { id: string; name: string }) => {
              const res = await fetch(
                `/api/projects/${project.id}/analyses?limit=5`
              );
              if (res.ok) {
                const data = await res.json();
                return (data.analyses || []).map((a: Analysis) => ({
                  ...a,
                  project: { id: project.id, name: project.name },
                }));
              }
              return [];
            });

          const analysesArrays = await Promise.all(analysisPromises);
          analysesArrays.forEach((arr) => allAnalyses.push(...arr));
        }

        // Sort by created_at and take the 5 most recent
        const recentAnalyses = allAnalyses
          .sort(
            (a, b) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
          )
          .slice(0, 5);

        setData({
          user,
          recentAnalyses,
          projectCount: projectsData.projects?.length || 0,
        });
      } catch (err) {
        console.error("Dashboard fetch error:", err);
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  const handleNewProject = () => {
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
  };

  const handleModalSuccess = () => {
    // Refresh the dashboard data
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 bg-gray-200 dark:bg-gray-800 rounded" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-64 bg-gray-200 dark:bg-gray-800 rounded-lg" />
          <div className="space-y-6">
            <div className="h-48 bg-gray-200 dark:bg-gray-800 rounded-lg" />
            <div className="h-48 bg-gray-200 dark:bg-gray-800 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 text-blue-600 hover:text-blue-700"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!data || !data.user) {
    return null;
  }

  const { user, recentAnalyses, projectCount } = data;
  const hasNoActivity = projectCount === 0 && recentAnalyses.length === 0;

  if (hasNoActivity) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
          Dashboard
        </h1>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <EmptyDashboard onNewProject={handleNewProject} />
          </div>
          <div className="space-y-6">
            <TierCard user={user} />
            <QuickActions onNewProject={handleNewProject} />
          </div>
        </div>
        <ProjectModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          onSuccess={handleModalSuccess}
          project={null}
        />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
        Dashboard
      </h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentAnalyses analyses={recentAnalyses} />
        </div>
        <div className="space-y-6">
          <TierCard user={user} />
          <QuickActions onNewProject={handleNewProject} />
        </div>
      </div>
      <ProjectModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
        project={null}
      />
    </div>
  );
}
