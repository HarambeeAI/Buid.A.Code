import LogtoClient from "@logto/next/edge";
import type { LogtoNextConfig } from "@logto/next";

export const logtoConfig: LogtoNextConfig = {
  endpoint: process.env.LOGTO_ENDPOINT || "",
  appId: process.env.LOGTO_APP_ID || "",
  appSecret: process.env.LOGTO_APP_SECRET || "",
  baseUrl: process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000",
  cookieSecret: process.env.JWT_SECRET || "your-cookie-secret-min-32-chars!!",
  cookieSecure: process.env.NODE_ENV === "production",
};

export const logtoClient = new LogtoClient(logtoConfig);
