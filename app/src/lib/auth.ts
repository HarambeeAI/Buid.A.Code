import { logtoClient } from "@/lib/logto";
import { NextRequest, NextResponse } from "next/server";
import type { IdTokenClaims } from "@logto/next/edge";

export type AuthenticatedContext = {
  userId: string;
  claims: IdTokenClaims;
};

export async function getSession(request: NextRequest) {
  try {
    const context = await logtoClient.getLogtoContext(request);
    if (!context.isAuthenticated || !context.claims) {
      return null;
    }

    return {
      userId: context.claims.sub,
      claims: context.claims,
    } as AuthenticatedContext;
  } catch (error) {
    console.error("Error getting session:", error);
    return null;
  }
}

export async function requireAuth(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return {
      session: null,
      response: NextResponse.json(
        { error: "Unauthorized", message: "Authentication required" },
        { status: 401 }
      ),
    };
  }
  return { session, response: null };
}

export function unauthorized(message = "Authentication required") {
  return NextResponse.json(
    { error: "Unauthorized", message },
    { status: 401 }
  );
}

export function forbidden(message = "Forbidden", code?: string) {
  return NextResponse.json(
    { error: "Forbidden", message, ...(code && { code }) },
    { status: 403 }
  );
}

export function adminForbidden() {
  return NextResponse.json(
    {
      error: "Forbidden",
      message: "Admin access required",
      code: "ADMIN_REQUIRED",
    },
    { status: 403 }
  );
}
