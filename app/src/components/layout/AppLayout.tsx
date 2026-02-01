"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

type User = {
  id: string;
  email: string;
  name: string | null;
  tier: "FREE" | "PRO";
  analyses_remaining: number | null;
  role: "USER" | "ADMIN";
};

type AppLayoutProps = {
  children: React.ReactNode;
  user: User | null;
};

const SIDEBAR_COLLAPSED_KEY = "sidebar_collapsed";

export function AppLayout({ children, user }: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Load saved sidebar state from localStorage
  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (saved !== null) {
      setSidebarCollapsed(saved === "true");
    }

    // Auto-collapse on narrow screens
    const mediaQuery = window.matchMedia("(max-width: 768px)");
    if (mediaQuery.matches) {
      setSidebarCollapsed(true);
    }

    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setSidebarCollapsed(true);
      }
    };
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  const toggleSidebar = () => {
    const newValue = !sidebarCollapsed;
    setSidebarCollapsed(newValue);
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(newValue));
  };

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <div className="animate-pulse">
          {/* Skeleton sidebar */}
          <div className="fixed left-0 top-0 w-64 h-screen bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800" />
          {/* Skeleton header */}
          <div className="fixed top-0 left-64 right-0 h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800" />
          {/* Skeleton content */}
          <div className="ml-64 pt-16 p-6">
            <div className="h-8 w-48 bg-gray-200 dark:bg-gray-800 rounded mb-4" />
            <div className="h-4 w-full bg-gray-200 dark:bg-gray-800 rounded mb-2" />
            <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-800 rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={toggleSidebar} />
      <Header user={user} sidebarCollapsed={sidebarCollapsed} />
      <main
        className={`pt-16 min-h-screen transition-all duration-300 ${
          sidebarCollapsed ? "ml-16" : "ml-64"
        }`}
      >
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
