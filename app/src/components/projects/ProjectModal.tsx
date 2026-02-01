"use client";

import { useState, useEffect, useCallback } from "react";

type Folder = {
  id: string;
  name: string;
  project_count: number;
};

type Project = {
  id: string;
  name: string;
  description: string | null;
  folder_id: string | null;
};

type ProjectModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (project: Project) => void;
  project?: Project | null; // If provided, it's edit mode
};

export default function ProjectModal({
  isOpen,
  onClose,
  onSuccess,
  project,
}: ProjectModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [folderId, setFolderId] = useState<string | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditMode = !!project;

  // Fetch folders when modal opens
  const fetchFolders = useCallback(async () => {
    setLoadingFolders(true);
    try {
      const res = await fetch("/api/folders");
      if (res.ok) {
        const data = await res.json();
        setFolders(data.folders || []);
      }
    } catch (err) {
      console.error("Failed to fetch folders:", err);
    } finally {
      setLoadingFolders(false);
    }
  }, []);

  // Initialize form when modal opens or project changes
  useEffect(() => {
    if (isOpen) {
      fetchFolders();
      if (project) {
        setName(project.name);
        setDescription(project.description || "");
        setFolderId(project.folder_id);
      } else {
        setName("");
        setDescription("");
        setFolderId(null);
      }
      setError(null);
    }
  }, [isOpen, project, fetchFolders]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const body = {
        name: name.trim(),
        description: description.trim() || null,
        folder_id: folderId,
      };

      const url = isEditMode ? `/api/projects/${project.id}` : "/api/projects";
      const method = isEditMode ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to save project");
      }

      const savedProject = await res.json();
      onSuccess(savedProject);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isEditMode ? "Edit Project" : "Create Project"}
          </h2>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-4">
            {/* Name field */}
            <div>
              <label
                htmlFor="project-name"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter project name"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                maxLength={255}
                required
                autoFocus
              />
            </div>

            {/* Description field */}
            <div>
              <label
                htmlFor="project-description"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Description
              </label>
              <textarea
                id="project-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter project description (optional)"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors resize-none"
                maxLength={1000}
              />
            </div>

            {/* Folder dropdown */}
            <div>
              <label
                htmlFor="project-folder"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Folder
              </label>
              <select
                id="project-folder"
                value={folderId || ""}
                onChange={(e) => setFolderId(e.target.value || null)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                disabled={loadingFolders}
              >
                <option value="">No folder</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
              {loadingFolders && (
                <p className="text-xs text-gray-500 mt-1">Loading folders...</p>
              )}
            </div>

            {/* Error message */}
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading && (
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
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
              {isEditMode ? "Save Changes" : "Create Project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
