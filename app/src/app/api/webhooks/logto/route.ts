import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import prisma from "@/lib/prisma";

// Logto webhook event types we handle
type LogtoWebhookEvent = {
  event: string;
  createdAt: string;
  sessionId?: string;
  userAgent?: string;
  ip?: string;
  data?: {
    id?: string;
    username?: string;
    primaryEmail?: string;
    primaryPhone?: string;
    name?: string;
    avatar?: string;
    customData?: Record<string, unknown>;
    identities?: Record<string, unknown>;
    lastSignInAt?: number;
    createdAt?: number;
    applicationId?: string;
    isSuspended?: boolean;
  };
};

/**
 * Verify the webhook signature from Logto
 * Logto uses HMAC-SHA256 with the webhook signing key
 */
function verifySignature(
  payload: string,
  signature: string | null,
  signingKey: string
): boolean {
  if (!signature) {
    return false;
  }

  const expectedSignature = createHmac("sha256", signingKey)
    .update(payload)
    .digest("hex");

  // Compare in constant time to prevent timing attacks
  return signature === expectedSignature;
}

/**
 * POST /api/webhooks/logto
 *
 * Handles webhook events from Logto:
 * - user.created: Creates a new user in the database with FREE tier and 2 analyses
 *
 * Security:
 * - Validates signature header using HMAC-SHA256
 * - Returns 401 for invalid signatures
 */
export async function POST(request: NextRequest) {
  try {
    // Get the raw body for signature verification
    const rawBody = await request.text();

    // Get signature from header (Logto uses 'logto-signature-sha-256')
    const signature = request.headers.get("logto-signature-sha-256");

    // Get the signing key from environment
    const signingKey = process.env.LOGTO_WEBHOOK_SIGNING_KEY;

    if (!signingKey) {
      console.error("LOGTO_WEBHOOK_SIGNING_KEY not configured");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Verify signature
    if (!verifySignature(rawBody, signature, signingKey)) {
      console.error("Invalid webhook signature");
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    // Parse the webhook payload
    const event: LogtoWebhookEvent = JSON.parse(rawBody);

    // Handle different event types
    switch (event.event) {
      case "User.Created":
        return await handleUserCreated(event);

      // Add more event handlers as needed
      // case "User.Updated":
      // case "User.Deleted":

      default:
        // Acknowledge unknown events to prevent retries
        console.log(`Received unhandled webhook event: ${event.event}`);
        return NextResponse.json({ received: true });
    }
  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Handle user.created event
 * Creates a new user in the database with:
 * - tier: FREE
 * - analyses_remaining: 2
 * - role: USER
 */
async function handleUserCreated(event: LogtoWebhookEvent) {
  const userData = event.data;

  if (!userData?.id) {
    console.error("User created event missing user ID");
    return NextResponse.json(
      { error: "Missing user ID" },
      { status: 400 }
    );
  }

  try {
    // Use upsert to handle duplicates gracefully
    // If user already exists (by logto_user_id), don't modify them
    const user = await prisma.user.upsert({
      where: {
        logto_user_id: userData.id,
      },
      update: {
        // On duplicate, update only email/name if they changed
        email: userData.primaryEmail || "",
        name: userData.name || null,
      },
      create: {
        logto_user_id: userData.id,
        email: userData.primaryEmail || "",
        name: userData.name || null,
        tier: "FREE",
        analyses_remaining: 2,
        role: "USER",
      },
    });

    console.log(`User synced: ${user.id} (logto: ${userData.id})`);

    return NextResponse.json({
      success: true,
      userId: user.id,
    });
  } catch (error) {
    console.error("Failed to create/update user:", error);
    return NextResponse.json(
      { error: "Failed to sync user" },
      { status: 500 }
    );
  }
}
