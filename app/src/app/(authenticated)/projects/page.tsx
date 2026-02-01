"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import ProjectModal from "@/components/projects/ProjectModal";

type Project = {
  id: string;
  name: string;
  description: string | null;
  folder_id: string | null;
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

type ProjectsData = {
  projects: Project[];
  pagination: PaginationData;
};

type Folder = {
  id: string;
  name: string;
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ProjectCard({
  project,
  onEdit,
}: {
  project: Project;
  onEdit: (project: Project) => void;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-md transition-all group">
      <div className="flex items-start justify-between mb-3">
        <Link
          href={`/projects/${project.id}`}
          className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0"
        >
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
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
        </Link>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            {project.analysis_count}{" "}
            {project.analysis_count === 1 ? "analysis" : "analyses"}
          </span>
          <button
            onClick={() => onEdit(project)}
            className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-all"
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
      </div>
      <Link href={`/projects/${project.id}`} className="block">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 truncate hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
          {project.name}
        </h3>
      </Link>
      {project.description && (
        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
          {project.description}
        </p>
      )}
      <p className="text-xs text-gray-500 dark:text-gray-500">
        Updated {formatDate(project.updated_at)}
      </p>
    </div>
  );
}

function EmptyState({ onCreateClick, folderName }: { onCreateClick: () => void; folderName?: string }) {
  return (
    <div className="text-center py-16">
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
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {folderName ? `No projects in "${folderName}"` : "No projects yet"}
      </h3>
      <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-sm mx-auto">
        {folderName
          ? "Create a project in this folder or move existing projects here."
          : "Create your first project to start organizing your building plan analyses."}
      </p>
      <button
        onClick={onCreateClick}
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
        {folderName ? "Create Project" : "Create Your First Project"}
      </button>
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
    <div className="flex items-center justify-center gap-1 mt-8">
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
      <div className="flex items-center justify-between mb-6">
        <div className="h-8 w-32 bg-gray-200 dark:bg-gray-800 rounded" />
        <div className="h-10 w-36 bg-gray-200 dark:bg-gray-800 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="h-40 bg-gray-200 dark:bg-gray-800 rounded-lg"
          />
        ))}
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const searchParams = useSearchParams();
  const folderId = searchParams.get("folder");

  const [data, setData] = useState<ProjectsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [folder, setFolder] = useState<Folder | null>(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // Fetch folder name when filtering by folder
  const fetchFolderName = useCallback(async (id: string) => {
    try {
      const res = await fetch("/api/folders");
      if (res.ok) {
        const data = await res.json();
        const found = data.folders?.find((f: Folder) => f.id === id);
        if (found) {
          setFolder(found);
        }
      }
    } catch {
      // Silently fail
    }
  }, []);

  const fetchProjects = useCallback(async (page: number, filterFolderId?: string | null) => {
    setLoading(true);
    setError(null);
    try {
      let url = `/api/projects?page=${page}&limit=12`;
      if (filterFolderId) {
        url += `&folder_id=${filterFolderId}`;
      }
      const res = await fetch(url);
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = "/api/auth/login";
          return;
        }
        throw new Error("Failed to fetch projects");
      }
      const data = await res.json();
      setData(data);
      setCurrentPage(page);
    } catch (err) {
      console.error("Projects fetch error:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects(1, folderId);
    if (folderId) {
      fetchFolderName(folderId);
    } else {
      setFolder(null);
    }
  }, [fetchProjects, fetchFolderName, folderId]);

  const handlePageChange = (page: number) => {
    fetchProjects(page, folderId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openCreateModal = () => {
    setEditingProject(null);
    setIsModalOpen(true);
  };

  const openEditModal = (project: Project) => {
    setEditingProject(project);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingProject(null);
  };

  const handleModalSuccess = () => {
    // Refresh the projects list
    fetchProjects(currentPage, folderId);
  };

  if (loading && !data) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
        <button
          onClick={() => fetchProjects(currentPage, folderId)}
          className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { projects, pagination } = data;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Projects
          </h1>
          {folder && (
            <div className="flex items-center gap-2">
              <span className="text-gray-400">/</span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full text-sm font-medium">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                {folder.name}
              </span>
              <Link
                href="/projects"
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                title="Clear filter"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Link>
            </div>
          )}
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
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
          New Project
        </button>
      </div>

      {projects.length === 0 ? (
        <EmptyState onCreateClick={openCreateModal} folderName={folder?.name} />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onEdit={openEditModal}
              />
            ))}
          </div>
          <Pagination pagination={pagination} onPageChange={handlePageChange} />
        </>
      )}

      {/* Project Modal */}
      <ProjectModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
        project={editingProject}
        defaultFolderId={folderId || undefined}
      />
    </div>
  );
}
