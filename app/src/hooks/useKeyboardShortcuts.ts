"use client";

import { useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";

export type KeyboardShortcutHandler = {
  key: string;
  description: string;
  action: () => void;
};

type UseKeyboardShortcutsOptions = {
  onOpenHelpOverlay: () => void;
  onToggleSearch?: () => void;
  onToggleFilter?: () => void;
  onExport?: () => void;
};

function isInputFocused(): boolean {
  const activeElement = document.activeElement;
  if (!activeElement) return false;

  const tagName = activeElement.tagName.toLowerCase();
  const isEditable =
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    (activeElement as HTMLElement).isContentEditable;

  return isEditable;
}

export function useKeyboardShortcuts({
  onOpenHelpOverlay,
  onToggleSearch,
  onToggleFilter,
  onExport,
}: UseKeyboardShortcutsOptions) {
  const router = useRouter();
  const pathname = usePathname();

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (isInputFocused()) return;

      // Don't trigger on modifier keys (except ? which needs shift)
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const key = event.key.toLowerCase();

      switch (key) {
        case "n":
          // Navigate to new analysis - need to be in a project context
          // For now, navigate to projects page if not already there
          if (!pathname.includes("/projects/")) {
            router.push("/projects");
          }
          // If on a project page, we could trigger new analysis modal
          break;

        case "/":
          event.preventDefault(); // Prevent browser's quick find
          onToggleSearch?.();
          break;

        case "f":
          onToggleFilter?.();
          break;

        case "e":
          onExport?.();
          break;

        case "?":
          event.preventDefault();
          onOpenHelpOverlay();
          break;

        default:
          break;
      }
    },
    [router, pathname, onOpenHelpOverlay, onToggleSearch, onToggleFilter, onExport]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);
}

// List of all keyboard shortcuts for the help overlay
export const KEYBOARD_SHORTCUTS = [
  { key: "N", description: "New Analysis" },
  { key: "/", description: "Search" },
  { key: "F", description: "Filter" },
  { key: "E", description: "Export" },
  { key: "?", description: "Show this help" },
];
