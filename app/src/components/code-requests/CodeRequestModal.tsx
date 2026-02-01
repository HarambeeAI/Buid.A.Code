"use client";

import { useState, useEffect, useCallback } from "react";

type Region = {
  code: string;
  name: string;
  flag: string;
  flag_url: string;
};

type CodeRequestModalProps = {
  isOpen: boolean;
  onClose: () => void;
  regions?: Region[];
  defaultRegion?: string;
};

export function CodeRequestModal({
  isOpen,
  onClose,
  regions: providedRegions,
  defaultRegion,
}: CodeRequestModalProps) {
  const [codeName, setCodeName] = useState("");
  const [region, setRegion] = useState(defaultRegion || "");
  const [description, setDescription] = useState("");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [regions, setRegions] = useState<Region[]>(providedRegions || []);
  const [loadingRegions, setLoadingRegions] = useState(!providedRegions);

  // Fetch regions if not provided
  const fetchRegions = useCallback(async () => {
    if (providedRegions) {
      setRegions(providedRegions);
      return;
    }

    setLoadingRegions(true);
    try {
      const res = await fetch("/api/regions");
      if (!res.ok) throw new Error("Failed to fetch regions");
      const data = await res.json();
      setRegions(data.regions);
    } catch (err) {
      console.error("Error fetching regions:", err);
    } finally {
      setLoadingRegions(false);
    }
  }, [providedRegions]);

  useEffect(() => {
    if (isOpen && regions.length === 0 && !providedRegions) {
      fetchRegions();
    }
  }, [isOpen, regions.length, providedRegions, fetchRegions]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setCodeName("");
      setRegion(defaultRegion || "");
      setDescription("");
      setReferenceUrl("");
      setError(null);
      setSuccess(false);
    }
  }, [isOpen, defaultRegion]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/code-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code_name: codeName,
          region,
          description: description || undefined,
          reference_url: referenceUrl || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to submit request");
      }

      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Request a Building Code
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {success ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Request Submitted
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                We&apos;ll notify you when this code becomes available.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              <div>
                <label htmlFor="codeName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Code Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="codeName"
                  type="text"
                  value={codeName}
                  onChange={(e) => setCodeName(e.target.value)}
                  placeholder="e.g., California Building Code 2022"
                  required
                  maxLength={255}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label htmlFor="region" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Region <span className="text-red-500">*</span>
                </label>
                {loadingRegions ? (
                  <div className="flex items-center justify-center py-2.5">
                    <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full" />
                  </div>
                ) : (
                  <select
                    id="region"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select a region</option>
                    {regions.map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.flag} {r.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell us more about this code or why you need it..."
                  rows={3}
                  maxLength={2000}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              <div>
                <label htmlFor="referenceUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Reference URL
                </label>
                <input
                  id="referenceUrl"
                  type="url"
                  value={referenceUrl}
                  onChange={(e) => setReferenceUrl(e.target.value)}
                  placeholder="https://example.com/building-code"
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !codeName || !region}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    submitting || !codeName || !region
                      ? "bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700 text-white"
                  }`}
                >
                  {submitting ? "Submitting..." : "Submit Request"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
