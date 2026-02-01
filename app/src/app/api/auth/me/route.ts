import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * GET /api/auth/me
 * Returns the authenticated user's profile and tier information.
 * Validates JWT via Logto session and fetches user data from database.
 */
export async function GET(request: NextRequest) {
  // Validate JWT via Logto session
  const { session, response } = await requireAuth(request);
  if (!session) {
    return response;
  }

  try {
    // Fetch user from database using Logto user ID
    const user = await prisma.user.findUnique({
      where: {
        logto_user_id: session.userId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        tier: true,
        analyses_remaining: true,
        role: true,
      },
    });

    if (!user) {
      // User exists in Logto but not in our database
      // This shouldn't happen if webhook is working, but handle gracefully
      return NextResponse.json(
        { error: "Not Found", message: "User not found in database" },
        { status: 404 }
      );
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to fetch user profile" },
      { status: 500 }
    );
  }
}
