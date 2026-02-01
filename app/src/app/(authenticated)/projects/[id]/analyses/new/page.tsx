"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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

type UploadState = {
  file: File | null;
  preview: string | null;
  filename: string;
  fileSize: number;
  pageCount: number | null;
  documentType: "PDF" | "PNG" | "JPG" | "TIFF" | null;
  fileKey: string | null;
  uploadProgress: number;
  uploadStatus: "idle" | "uploading" | "confirming" | "ready" | "error";
  uploadError: string | null;
};

type WizardData = {
  // Step 1
  file: File | null;
  fileKey: string | null;
  documentType: "PDF" | "PNG" | "JPG" | "TIFF" | null;
  pageCount: number;
  description: string;
  pageNumbers: string;
};

const ACCEPTED_TYPES = {
  "application/pdf": "PDF",
  "image/png": "PNG",
  "image/jpeg": "JPG",
  "image/tiff": "TIFF",
} as const;

const ACCEPTED_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg", ".tif", ".tiff"];

const MAX_PAGE_COUNT = {
  FREE: 5,
  PRO: 50,
};

const MAX_FILE_SIZE = {
  FREE: 10 * 1024 * 1024, // 10MB
  PRO: 100 * 1024 * 1024, // 100MB
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileTypeIcon({ type }: { type: WizardData["documentType"] }) {
  const iconClasses = "w-12 h-12";

  switch (type) {
    case "PDF":
      return (
        <div className="w-20 h-20 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
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
        <div className="w-20 h-20 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
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
        <div className="w-20 h-20 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
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

function DropZone({
  onFileSelect,
  isLoading,
  isDragActive,
  onDragEnter,
  onDragLeave,
  onDrop,
}: {
  onFileSelect: (file: File) => void;
  isLoading: boolean;
  isDragActive: boolean;
  onDragEnter: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  return (
    <div
      onClick={handleClick}
      onDragEnter={onDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`
        relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all
        ${isDragActive
          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
          : "border-gray-300 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-gray-50 dark:hover:bg-gray-800/50"
        }
        ${isLoading ? "pointer-events-none opacity-50" : ""}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS.join(",")}
        onChange={handleChange}
        className="hidden"
        disabled={isLoading}
      />

      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-blue-600 dark:text-blue-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
        </div>

        <div>
          <p className="text-lg font-medium text-gray-900 dark:text-white">
            {isDragActive ? "Drop your file here" : "Drag and drop your building plan"}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            or click to browse
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded">PDF</span>
          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded">PNG</span>
          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded">JPG</span>
          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded">TIFF</span>
        </div>
      </div>
    </div>
  );
}

function FilePreview({
  upload,
  user,
  onRemove,
}: {
  upload: UploadState;
  user: User;
  onRemove: () => void;
}) {
  const maxPages = MAX_PAGE_COUNT[user.tier];
  const exceedsPageLimit = upload.pageCount !== null && upload.pageCount > maxPages;

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-6">
      <div className="flex items-start gap-4">
        <FileTypeIcon type={upload.documentType} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white truncate">
              {upload.filename}
            </h3>
            <button
              onClick={onRemove}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
              title="Remove file"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
            <span>{formatFileSize(upload.fileSize)}</span>
            <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
            <span>{upload.documentType}</span>
            {upload.pageCount !== null && (
              <>
                <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                <span className={exceedsPageLimit ? "text-red-500 font-medium" : ""}>
                  {upload.pageCount} {upload.pageCount === 1 ? "page" : "pages"}
                </span>
              </>
            )}
          </div>

          {/* Upload progress */}
          {(upload.uploadStatus === "uploading" || upload.uploadStatus === "confirming") && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">
                  {upload.uploadStatus === "uploading" ? "Uploading..." : "Processing..."}
                </span>
                <span className="text-gray-600 dark:text-gray-400">{upload.uploadProgress}%</span>
              </div>
              <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${upload.uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Upload complete */}
          {upload.uploadStatus === "ready" && (
            <div className="flex items-center gap-2 mt-3 text-sm text-green-600 dark:text-green-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>File uploaded successfully</span>
            </div>
          )}

          {/* Upload error */}
          {upload.uploadStatus === "error" && upload.uploadError && (
            <div className="flex items-center gap-2 mt-3 text-sm text-red-600 dark:text-red-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{upload.uploadError}</span>
            </div>
          )}

          {/* Page limit warning */}
          {exceedsPageLimit && upload.uploadStatus === "ready" && (
            <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="flex items-start gap-3">
                <svg
                  className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Page limit exceeded
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    Free tier allows up to {maxPages} pages per analysis.
                    Your document has {upload.pageCount} pages.
                  </p>
                  <Link
                    href="/settings/upgrade"
                    className="inline-flex items-center mt-2 text-sm font-medium text-amber-700 dark:text-amber-300 hover:text-amber-800 dark:hover:text-amber-200"
                  >
                    Upgrade to Pro for up to 50 pages
                    <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TierInfo({ user }: { user: User }) {
  const maxPages = MAX_PAGE_COUNT[user.tier];
  const maxSize = MAX_FILE_SIZE[user.tier];

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <span
          className={`px-2 py-0.5 rounded text-xs font-medium ${
            user.tier === "PRO"
              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
              : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
          }`}
        >
          {user.tier}
        </span>
        <span className="text-sm text-gray-600 dark:text-gray-400">tier limits</span>
      </div>
      <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
        <li className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Up to {maxPages} pages per document
        </li>
        <li className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
          </svg>
          Max file size: {formatFileSize(maxSize)}
        </li>
        {user.tier === "FREE" && user.analyses_remaining !== null && (
          <li className="flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            {user.analyses_remaining} of 2 free analyses remaining
          </li>
        )}
      </ul>
    </div>
  );
}

export default function AnalysisWizardStep1() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const [upload, setUpload] = useState<UploadState>({
    file: null,
    preview: null,
    filename: "",
    fileSize: 0,
    pageCount: null,
    documentType: null,
    fileKey: null,
    uploadProgress: 0,
    uploadStatus: "idle",
    uploadError: null,
  });

  const [wizardData, setWizardData] = useState<WizardData>({
    file: null,
    fileKey: null,
    documentType: null,
    pageCount: 1,
    description: "",
    pageNumbers: "",
  });

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

  const validateFile = useCallback(
    (file: File): string | null => {
      if (!user) return "User not loaded";

      // Check file type
      const mimeType = file.type;
      if (!Object.keys(ACCEPTED_TYPES).includes(mimeType)) {
        return "Invalid file type. Please upload a PDF, PNG, JPG, or TIFF file.";
      }

      // Check file size
      const maxSize = MAX_FILE_SIZE[user.tier];
      if (file.size > maxSize) {
        return `File size exceeds ${formatFileSize(maxSize)} limit for ${user.tier} tier.`;
      }

      return null;
    },
    [user]
  );

  const uploadFile = useCallback(
    async (file: File) => {
      if (!user) return;

      const validationError = validateFile(file);
      if (validationError) {
        setUpload((prev) => ({
          ...prev,
          uploadStatus: "error",
          uploadError: validationError,
        }));
        return;
      }

      const mimeType = file.type as keyof typeof ACCEPTED_TYPES;
      const documentType = ACCEPTED_TYPES[mimeType];

      setUpload({
        file,
        preview: null,
        filename: file.name,
        fileSize: file.size,
        pageCount: null,
        documentType,
        fileKey: null,
        uploadProgress: 0,
        uploadStatus: "uploading",
        uploadError: null,
      });

      try {
        // Step 1: Get presigned URL
        setUpload((prev) => ({ ...prev, uploadProgress: 10 }));

        const presignedRes = await fetch("/api/upload/presigned-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            content_type: mimeType,
            file_size: file.size,
          }),
        });

        if (!presignedRes.ok) {
          const data = await presignedRes.json();
          throw new Error(data.message || "Failed to get upload URL");
        }

        const { upload_url, file_key, document_type } = await presignedRes.json();

        setUpload((prev) => ({
          ...prev,
          uploadProgress: 20,
          documentType: document_type,
        }));

        // Step 2: Upload to S3
        const uploadRes = await fetch(upload_url, {
          method: "PUT",
          headers: { "Content-Type": mimeType },
          body: file,
        });

        if (!uploadRes.ok) {
          throw new Error("Failed to upload file to storage");
        }

        setUpload((prev) => ({ ...prev, uploadProgress: 70, uploadStatus: "confirming" }));

        // Step 3: Confirm upload
        const confirmRes = await fetch("/api/upload/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file_key }),
        });

        if (!confirmRes.ok) {
          const data = await confirmRes.json();
          throw new Error(data.message || "Failed to confirm upload");
        }

        const { page_count, document_type: confirmedType } = await confirmRes.json();

        setUpload((prev) => ({
          ...prev,
          uploadProgress: 100,
          uploadStatus: "ready",
          fileKey: file_key,
          documentType: confirmedType,
          pageCount: page_count,
        }));

        setWizardData((prev) => ({
          ...prev,
          file,
          fileKey: file_key,
          documentType: confirmedType,
          pageCount: page_count,
        }));
      } catch (err) {
        console.error("Upload error:", err);
        setUpload((prev) => ({
          ...prev,
          uploadStatus: "error",
          uploadError: err instanceof Error ? err.message : "Upload failed",
        }));
      }
    },
    [user, validateFile]
  );

  const handleFileSelect = useCallback(
    (file: File) => {
      uploadFile(file);
    },
    [uploadFile]
  );

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleRemoveFile = () => {
    setUpload({
      file: null,
      preview: null,
      filename: "",
      fileSize: 0,
      pageCount: null,
      documentType: null,
      fileKey: null,
      uploadProgress: 0,
      uploadStatus: "idle",
      uploadError: null,
    });
    setWizardData((prev) => ({
      ...prev,
      file: null,
      fileKey: null,
      documentType: null,
      pageCount: 1,
    }));
  };

  const handleNext = () => {
    // Store wizard data in sessionStorage for next step
    sessionStorage.setItem(
      `wizard_${projectId}`,
      JSON.stringify({
        ...wizardData,
        file: null, // Can't store File object in sessionStorage
      })
    );
    router.push(`/projects/${projectId}/analyses/new/step2`);
  };

  const isNextDisabled =
    upload.uploadStatus !== "ready" ||
    !user ||
    (upload.pageCount !== null && upload.pageCount > MAX_PAGE_COUNT[user.tier]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">{error || "Failed to load user"}</p>
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
                  Step 1 of 3: Upload Document
                </p>
              </div>
            </div>

            {/* Step indicators */}
            <div className="hidden sm:flex items-center gap-2">
              <div className="flex items-center">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-medium">
                  1
                </div>
                <div className="w-12 h-0.5 bg-gray-200 dark:bg-gray-700 ml-2" />
              </div>
              <div className="flex items-center">
                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-400 flex items-center justify-center text-sm font-medium">
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Upload Building Plan
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Upload your architectural drawing to begin the compliance analysis.
              </p>
            </div>

            {/* File drop zone or preview */}
            {upload.file ? (
              <FilePreview upload={upload} user={user} onRemove={handleRemoveFile} />
            ) : (
              <DropZone
                onFileSelect={handleFileSelect}
                isLoading={upload.uploadStatus === "uploading"}
                isDragActive={isDragActive}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              />
            )}

            {/* Optional details */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Additional Details
                <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">
                  (Optional)
                </span>
              </h3>

              <div>
                <label
                  htmlFor="description"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Description
                </label>
                <textarea
                  id="description"
                  rows={3}
                  value={wizardData.description}
                  onChange={(e) =>
                    setWizardData((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Add any context about this document..."
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors resize-none"
                />
              </div>

              <div>
                <label
                  htmlFor="pageNumbers"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Specific Pages to Analyze
                </label>
                <input
                  id="pageNumbers"
                  type="text"
                  value={wizardData.pageNumbers}
                  onChange={(e) =>
                    setWizardData((prev) => ({ ...prev, pageNumbers: e.target.value }))
                  }
                  placeholder="e.g., 1-5, 8, 12-15 (leave empty for all pages)"
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Leave empty to analyze all pages
                </p>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <TierInfo user={user} />

            {user.tier === "FREE" && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-2">
                  Need more capacity?
                </h4>
                <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                  Upgrade to Pro for unlimited analyses, up to 50 pages per document, and PDF export.
                </p>
                <Link
                  href="/settings/upgrade"
                  className="inline-flex items-center text-sm font-medium text-blue-700 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-200"
                >
                  Learn more
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link
              href={`/projects/${projectId}`}
              className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
            >
              Cancel
            </Link>
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
              Next: Select Codes
              <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
