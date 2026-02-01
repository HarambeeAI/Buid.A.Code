import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const ConfirmUploadSchema = z.object({
  file_key: z.string().min(1, "File key is required"),
});

/**
 * POST /api/upload/confirm
 * Confirms that a file was uploaded and returns its metadata including page count.
 */
export async function POST(request: NextRequest) {
  const { session, response } = await requireAuth(request);
  if (!session) {
    return response;
  }

  try {
    const body = await request.json();
    const validation = ConfirmUploadSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Bad Request", message: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { file_key } = validation.data;

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { logto_user_id: session.userId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Not Found", message: "User not found" },
        { status: 404 }
      );
    }

    // Verify file key belongs to this user
    const expectedPrefix = `uploads/${user.id}/`;
    if (!file_key.startsWith(expectedPrefix)) {
      return NextResponse.json(
        { error: "Forbidden", message: "Invalid file key" },
        { status: 403 }
      );
    }

    // Check if file exists in bucket
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

    // Verify file exists by making a HEAD request
    const fileExists = await checkFileExists({
      bucketUrl,
      accessKey,
      secretKey,
      fileKey: file_key,
    });

    if (!fileExists.exists) {
      return NextResponse.json(
        { error: "Not Found", message: "File not found. Please upload the file first." },
        { status: 404 }
      );
    }

    // Determine file type from key
    const extension = file_key.split(".").pop()?.toLowerCase() || "";
    const documentType = getDocumentTypeFromExtension(extension);

    // Get page count based on file type
    let pageCount = 1;

    if (documentType === "PDF") {
      // For PDFs, we need to fetch the file and count pages
      // In production, this would be done by a worker service using PyMuPDF
      // For MVP, we can use a simple approach or estimate
      pageCount = await getPdfPageCount({
        bucketUrl,
        accessKey,
        secretKey,
        fileKey: file_key,
        contentLength: fileExists.contentLength,
      });
    } else if (documentType === "TIFF") {
      // Multi-page TIFFs would need special handling
      // For MVP, assume single page unless explicitly detected
      pageCount = 1;
    } else {
      // PNG, JPG are always single page
      pageCount = 1;
    }

    return NextResponse.json({
      file_key,
      document_type: documentType,
      file_size: fileExists.contentLength,
      page_count: pageCount,
      confirmed: true,
    });
  } catch (error) {
    console.error("Error confirming upload:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to confirm upload" },
      { status: 500 }
    );
  }
}

/**
 * Get document type from file extension
 */
function getDocumentTypeFromExtension(extension: string): "PDF" | "PNG" | "JPG" | "TIFF" {
  const typeMap: Record<string, "PDF" | "PNG" | "JPG" | "TIFF"> = {
    pdf: "PDF",
    png: "PNG",
    jpg: "JPG",
    jpeg: "JPG",
    tiff: "TIFF",
    tif: "TIFF",
  };
  return typeMap[extension] || "PDF";
}

/**
 * Check if a file exists in the bucket using HEAD request
 */
async function checkFileExists({
  bucketUrl,
  accessKey,
  secretKey,
  fileKey,
}: {
  bucketUrl: string;
  accessKey: string;
  secretKey: string;
  fileKey: string;
}): Promise<{ exists: boolean; contentLength: number; contentType: string }> {
  const url = new URL(bucketUrl);
  const bucket = url.pathname.replace(/^\//, "").split("/")[0] || "";
  const region = process.env.BUCKET_REGION || "us-east-1";

  const fullUrl = `${url.protocol}//${url.host}/${bucket}/${fileKey}`;

  // Generate signed HEAD request
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.substring(0, 8);

  const headers = await signRequest({
    method: "HEAD",
    url: fullUrl,
    accessKey,
    secretKey,
    region,
    amzDate,
    dateStamp,
  });

  try {
    const response = await fetch(fullUrl, {
      method: "HEAD",
      headers,
    });

    if (response.ok) {
      const contentLength = parseInt(response.headers.get("content-length") || "0", 10);
      const contentType = response.headers.get("content-type") || "";
      return { exists: true, contentLength, contentType };
    }

    return { exists: false, contentLength: 0, contentType: "" };
  } catch (error) {
    console.error("Error checking file existence:", error);
    return { exists: false, contentLength: 0, contentType: "" };
  }
}

/**
 * Get PDF page count
 * In production, this would use PyMuPDF or similar library.
 * For MVP, we use a heuristic based on file size or fetch the PDF header.
 */
async function getPdfPageCount({
  bucketUrl,
  accessKey,
  secretKey,
  fileKey,
  contentLength,
}: {
  bucketUrl: string;
  accessKey: string;
  secretKey: string;
  fileKey: string;
  contentLength: number;
}): Promise<number> {
  // Heuristic: average PDF page is roughly 50-100KB
  // This is a rough estimate - the actual page count will be determined
  // by the worker service during document processing
  // For now, provide a reasonable estimate that won't exceed tier limits
  const estimatedPages = Math.max(1, Math.ceil(contentLength / 75000));

  // Try to get actual page count by fetching PDF and parsing trailer
  try {
    const url = new URL(bucketUrl);
    const bucket = url.pathname.replace(/^\//, "").split("/")[0] || "";
    const fullUrl = `${url.protocol}//${url.host}/${bucket}/${fileKey}`;

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.substring(0, 8);
    const region = process.env.BUCKET_REGION || "us-east-1";

    // Fetch last 10KB of PDF to find /Count or /N
    const rangeStart = Math.max(0, contentLength - 10240);
    const headers = await signRequest({
      method: "GET",
      url: fullUrl,
      accessKey,
      secretKey,
      region,
      amzDate,
      dateStamp,
      additionalHeaders: {
        Range: `bytes=${rangeStart}-${contentLength - 1}`,
      },
    });

    const response = await fetch(fullUrl, {
      method: "GET",
      headers,
    });

    if (response.ok) {
      const buffer = await response.arrayBuffer();
      const text = new TextDecoder("latin1").decode(buffer);

      // Look for /Count pattern which indicates page count in PDF
      const countMatch = text.match(/\/Count\s+(\d+)/);
      if (countMatch) {
        const count = parseInt(countMatch[1], 10);
        if (count > 0 && count < 1000) {
          return count;
        }
      }

      // Look for /N pattern in linearized PDFs
      const nMatch = text.match(/\/N\s+(\d+)/);
      if (nMatch) {
        const n = parseInt(nMatch[1], 10);
        if (n > 0 && n < 1000) {
          return n;
        }
      }
    }
  } catch (error) {
    console.error("Error parsing PDF for page count:", error);
  }

  // Fall back to estimate
  return estimatedPages;
}

/**
 * Sign an AWS request
 */
async function signRequest({
  method,
  url,
  accessKey,
  secretKey,
  region,
  amzDate,
  dateStamp,
  additionalHeaders = {},
}: {
  method: string;
  url: string;
  accessKey: string;
  secretKey: string;
  region: string;
  amzDate: string;
  dateStamp: string;
  additionalHeaders?: Record<string, string>;
}): Promise<Record<string, string>> {
  const parsedUrl = new URL(url);
  const host = parsedUrl.host;
  const canonicalUri = parsedUrl.pathname;
  const service = "s3";

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

  // Build headers
  const headers: Record<string, string> = {
    Host: host,
    "X-Amz-Date": amzDate,
    "X-Amz-Content-Sha256": "UNSIGNED-PAYLOAD",
    ...additionalHeaders,
  };

  // Build signed headers list
  const signedHeadersList = Object.keys(headers)
    .map((k) => k.toLowerCase())
    .sort();
  const signedHeaders = signedHeadersList.join(";");

  // Build canonical headers
  const canonicalHeaders = signedHeadersList
    .map((k) => `${k}:${headers[Object.keys(headers).find((h) => h.toLowerCase() === k) || k]}`)
    .join("\n") + "\n";

  // Build canonical request
  const canonicalRequest = [
    method,
    canonicalUri,
    "", // Query string
    canonicalHeaders,
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  // Hash the canonical request
  const canonicalRequestHash = await sha256Hex(canonicalRequest);

  // Build string to sign
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    canonicalRequestHash,
  ].join("\n");

  // Calculate signature
  const signingKey = await getSignatureKey(secretKey, dateStamp, region, service);
  const signature = await hmacSha256Hex(signingKey, stringToSign);

  // Build authorization header
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    ...headers,
    Authorization: authorization,
  };
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
  const kDate = await hmacSha256(encoder.encode(`AWS4${secretKey}`).buffer as ArrayBuffer, dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  return hmacSha256(kService, "aws4_request");
}
