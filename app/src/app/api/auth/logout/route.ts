import { logtoClient } from "@/lib/logto";
import { type NextRequest } from "next/server";

export const runtime = "edge";

export async function POST(request: NextRequest) {
  return logtoClient.handleSignOut()(request);
}
