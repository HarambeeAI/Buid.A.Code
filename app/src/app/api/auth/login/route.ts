import { logtoClient, logtoConfig } from "@/lib/logto";
import { type NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const redirectUri = `${logtoConfig.baseUrl}/api/auth/callback`;
  return logtoClient.handleSignIn(redirectUri)(request);
}
