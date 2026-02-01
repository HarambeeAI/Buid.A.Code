import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import crypto from "crypto";

type AllowedDocumentType = "PDF" | "PNG" | "JPG" | "TIFF";
const MIME_TYPE_MAP: Record<string, AllowedDocumentType> = {
  "application/pdf": "PDF",
  "image/png": "PNG",
  "image/jpeg": "JPG",
  "image/tiff": "TIFF",
};

// Size limits in bytes
const SIZE_LIMITS = {
  FREE: 10 * 1024 * 1024, // 10MB
  PRO: 100 * 1024 * 1024, // 100MB
} as const;

const PresignedUrlSchema = z.object({
  filename: z.string().min(1, "Filename is required").max(255),
  content_type: z.string().refine(
    (type) => Object.keys(MIME_TYPE_MAP).includes(type),
    "Invalid file type. Allowed: PDF, PNG, JPG, TIFF"
  ),
  file_size: z.number().int().positive("File size must be positive"),
});

/**
 * POST /api/upload/presigned-url
 * Generates a presigned URL for file upload with tier-based validation.
 */
export async function POST(request: NextRequest) {
  const { session, response } = await requireAuth(request);
  if (!session) {
    return response;
  }

  try {
    const body = await request.json();
    const validation = PresignedUrlSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Bad Request", message: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { filename, content_type, file_size } = validation.data;

    // Get user from database with tier info
    const user = await prisma.user.findUnique({
      where: { logto_user_id: session.userId },
      select: {
        id: true,
        tier: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Not Found", message: "User not found" },
        { status: 404 }
      );
    }

    // Check file size based on tier
    const sizeLimit = user.tier === "FREE" ? SIZE_LIMITS.FREE : SIZE_LIMITS.PRO;
    const sizeLimitMB = sizeLimit / (1024 * 1024);

    if (file_size > sizeLimit) {
      return NextResponse.json(
        {
          error: "Forbidden",
          message: `File size exceeds limit. ${user.tier === "FREE" ? "Free tier" : "Pro tier"} is limited to ${sizeLimitMB}MB. Upgrade to Pro for up to 100MB.`,
          code: "FILE_SIZE_EXCEEDED",
          limit: sizeLimit,
          limit_mb: sizeLimitMB,
          requested: file_size,
        },
        { status: 403 }
      );
    }

    // Map content type to document type
    const documentType = MIME_TYPE_MAP[content_type];

    // Generate unique file key
    const ext = getExtensionFromMimeType(content_type);
    const timestamp = Date.now();
    const randomId = crypto.randomUUID().replace(/-/g, "").substring(0, 8);
    const sanitizedFilename = sanitizeFilename(filename);
    const fileKey = `uploads/${user.id}/${timestamp}-${randomId}-${sanitizedFilename}${ext}`;

    // Generate presigned URL for S3-compatible storage (Railway Buckets)
    const bucketUrl = process.env.BUCKET_URL;
    const accessKey = process.env.BUCKET_ACCESS_KEY;
    const secretKey = process.env.BUCKET_SECRET_KEY;

    if (!bucketUrl || !accessKey || !secretKey) {
      console.error("Missing bucket configuration");
      return NextResponse.json(
        { error: "Internal Server Error", message: "Storage not configured" },
        { status: 500 }
      );
    }

    // Generate presigned PUT URL
    const presignedUrl = await generatePresignedPutUrl({
      bucketUrl,
      accessKey,
      secretKey,
      fileKey,
      contentType: content_type,
      expiresIn: 3600, // 1 hour
    });

    return NextResponse.json({
      upload_url: presignedUrl,
      file_key: fileKey,
      document_type: documentType,
      expires_in: 3600,
    });
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to generate upload URL" },
      { status: 500 }
    );
  }
}

/**
 * Sanitize filename for safe storage
 */
function sanitizeFilename(filename: string): string {
  // Remove extension, sanitize, and limit length
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
  return nameWithoutExt
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 50);
}

/**
 * Get file extension from MIME type
 */
function getExtensionFromMimeType(mimeType: string): string {
  const extMap: Record<string, string> = {
    "application/pdf": ".pdf",
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/tiff": ".tiff",
  };
  return extMap[mimeType] || "";
}

/**
 * Generate a presigned PUT URL for S3-compatible storage
 * Uses AWS Signature Version 4
 */
async function generatePresignedPutUrl({
  bucketUrl,
  accessKey,
  secretKey,
  fileKey,
  contentType,
  expiresIn,
}: {
  bucketUrl: string;
  accessKey: string;
  secretKey: string;
  fileKey: string;
  contentType: string;
  expiresIn: number;
}): Promise<string> {
  const url = new URL(bucketUrl);
  const host = url.host;
  const bucket = url.pathname.replace(/^\//, "").split("/")[0] || "";
  const region = process.env.BUCKET_REGION || "us-east-1";
  const service = "s3";

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.substring(0, 8);

  // Build canonical request for presigned URL
  const method = "PUT";
  const canonicalUri = `/${bucket}/${fileKey}`.replace(/\/+/g, "/");

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const credential = `${accessKey}/${credentialScope}`;

  // Query parameters for presigned URL
  const queryParams = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": credential,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": expiresIn.toString(),
    "X-Amz-SignedHeaders": "content-type;host",
  });

  const canonicalQueryString = [...queryParams.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\n`;
  const signedHeaders = "content-type;host";

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  // Create string to sign
  const canonicalRequestHash = await sha256Hex(canonicalRequest);
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    canonicalRequestHash,
  ].join("\n");

  // Calculate signature
  const signingKey = await getSignatureKey(secretKey, dateStamp, region, service);
  const signature = await hmacSha256Hex(signingKey, stringToSign);

  // Build final presigned URL
  queryParams.set("X-Amz-Signature", signature);

  const finalUrl = new URL(`${url.protocol}//${host}${canonicalUri}`);
  for (const [key, value] of queryParams.entries()) {
    finalUrl.searchParams.set(key, value);
  }

  return finalUrl.toString();
}

/**
 * SHA256 hash as hex string
 */
async function sha256Hex(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest("SHA-256", encoder.encode(data));
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * HMAC-SHA256 with key
 */
async function hmacSha256(key: ArrayBuffer, data: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
}

/**
 * HMAC-SHA256 as hex string
 */
async function hmacSha256Hex(key: ArrayBuffer, data: string): Promise<string> {
  const buffer = await hmacSha256(key, data);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Get AWS Signature Version 4 signing key
 */
async function getSignatureKey(
  secretKey: string,
  dateStamp: string,
  region: string,
  service: string
): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const kDate = await hmacSha256(encoder.encode(`AWS4${secretKey}`).buffer, dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  return hmacSha256(kService, "aws4_request");
}
