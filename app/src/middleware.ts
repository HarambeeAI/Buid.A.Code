import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Use Node.js runtime for Prisma compatibility
export const runtime = "nodejs";

/**
 * Middleware to protect admin routes.
 * Checks role=ADMIN on /api/admin/* and /admin/* routes.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if this is an admin route
  const isAdminRoute =
    pathname.startsWith("/api/admin") || pathname.startsWith("/admin");

  if (!isAdminRoute) {
    // Not an admin route, allow through
    return NextResponse.next();
  }

  // For admin routes, verify authentication first
  const session = await getSession(request);

  if (!session) {
    // Not authenticated
    if (pathname.startsWith("/api/admin")) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Authentication required" },
        { status: 401 }
      );
    }
    // For page routes, redirect to login
    const loginUrl = new URL("/api/auth/login", request.url);
    loginUrl.searchParams.set("returnTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Check if user has admin role
  const user = await prisma.user.findUnique({
    where: { logto_user_id: session.userId },
    select: { role: true },
  });

  if (!user || user.role !== "ADMIN") {
    // User is not an admin
    if (pathname.startsWith("/api/admin")) {
      return NextResponse.json(
        {
          error: "Forbidden",
          message: "Admin access required",
          code: "ADMIN_REQUIRED",
        },
        { status: 403 }
      );
    }
    // For page routes, redirect to dashboard with error
    const dashboardUrl = new URL("/", request.url);
    dashboardUrl.searchParams.set("error", "admin_required");
    return NextResponse.redirect(dashboardUrl);
  }

  // User is admin, allow through
  return NextResponse.next();
}

// Configure which routes this middleware applies to
export const config = {
  matcher: [
    // API admin routes
    "/api/admin/:path*",
    // Admin page routes
    "/admin/:path*",
  ],
};
