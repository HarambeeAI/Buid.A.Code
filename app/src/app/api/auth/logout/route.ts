import { logtoClient, logtoConfig } from "@/lib/logto";
import { type NextRequest } from "next/server";

export const runtime = "edge";

export async function POST(request: NextRequest) {
  const postLogoutRedirectUri = logtoConfig.baseUrl;
  return logtoClient.handleSignOut(postLogoutRedirectUri)(request);
}
