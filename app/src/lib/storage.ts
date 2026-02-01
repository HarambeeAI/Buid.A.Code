import crypto from "crypto";

/**
 * Storage utility for S3-compatible bucket operations
 * Used by the analysis pipeline for fetching and storing documents
 */

interface StorageConfig {
  bucketUrl: string;
  accessKey: string;
  secretKey: string;
  region: string;
}

function getStorageConfig(): StorageConfig {
  const bucketUrl = process.env.BUCKET_URL;
  const accessKey = process.env.BUCKET_ACCESS_KEY;
  const secretKey = process.env.BUCKET_SECRET_KEY;
  const region = process.env.BUCKET_REGION || "us-east-1";

  if (!bucketUrl || !accessKey || !secretKey) {
    throw new Error("Missing bucket configuration environment variables");
  }

  return { bucketUrl, accessKey, secretKey, region };
}

/**
 * Parse bucket URL to extract host and bucket name
 */
function parseBucketUrl(bucketUrl: string): { host: string; bucket: string; protocol: string } {
  const url = new URL(bucketUrl);
  const host = url.host;
  const bucket = url.pathname.replace(/^\//, "").split("/")[0] || "";
  return { host, bucket, protocol: url.protocol };
}

/**
 * Generate AWS Signature V4 headers for GET request
 */
async function generateGetHeaders(
  config: StorageConfig,
  fileKey: string
): Promise<Record<string, string>> {
  const { bucketUrl, accessKey, secretKey, region } = config;
  const { host, bucket } = parseBucketUrl(bucketUrl);
  const service = "s3";

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.substring(0, 8);

  const method = "GET";
  const canonicalUri = `/${bucket}/${fileKey}`.replace(/\/+/g, "/");
  const canonicalQueryString = "";
  const payloadHash = await sha256Hex("");

  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const canonicalRequestHash = await sha256Hex(canonicalRequest);
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    canonicalRequestHash,
  ].join("\n");

  const signingKey = await getSignatureKey(secretKey, dateStamp, region, service);
  const signature = await hmacSha256Hex(signingKey, stringToSign);

  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    Authorization: authorization,
    "x-amz-date": amzDate,
    "x-amz-content-sha256": payloadHash,
    Host: host,
  };
}

/**
 * Generate AWS Signature V4 headers for PUT request
 */
async function generatePutHeaders(
  config: StorageConfig,
  fileKey: string,
  contentType: string,
  body: Buffer
): Promise<Record<string, string>> {
  const { bucketUrl, accessKey, secretKey, region } = config;
  const { host, bucket } = parseBucketUrl(bucketUrl);
  const service = "s3";

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.substring(0, 8);

  const method = "PUT";
  const canonicalUri = `/${bucket}/${fileKey}`.replace(/\/+/g, "/");
  const canonicalQueryString = "";
  const payloadHash = await sha256HexBuffer(body);

  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const canonicalRequestHash = await sha256Hex(canonicalRequest);
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    canonicalRequestHash,
  ].join("\n");

  const signingKey = await getSignatureKey(secretKey, dateStamp, region, service);
  const signature = await hmacSha256Hex(signingKey, stringToSign);

  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    Authorization: authorization,
    "Content-Type": contentType,
    "x-amz-date": amzDate,
    "x-amz-content-sha256": payloadHash,
    Host: host,
  };
}

/**
 * Fetch a file from the bucket
 */
export async function fetchFromBucket(fileKey: string): Promise<Buffer> {
  const config = getStorageConfig();
  const { bucketUrl } = config;
  const { host, bucket, protocol } = parseBucketUrl(bucketUrl);

  const url = `${protocol}//${host}/${bucket}/${fileKey}`;
  const headers = await generateGetHeaders(config, fileKey);

  const response = await fetch(url, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch file from bucket: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Upload a file to the bucket
 */
export async function uploadToBucket(
  fileKey: string,
  data: Buffer,
  contentType: string
): Promise<void> {
  const config = getStorageConfig();
  const { bucketUrl } = config;
  const { host, bucket, protocol } = parseBucketUrl(bucketUrl);

  const url = `${protocol}//${host}/${bucket}/${fileKey}`;
  const headers = await generatePutHeaders(config, fileKey, contentType, data);

  const response = await fetch(url, {
    method: "PUT",
    headers,
    body: new Uint8Array(data),
  });

  if (!response.ok) {
    throw new Error(`Failed to upload file to bucket: ${response.status} ${response.statusText}`);
  }
}

/**
 * Generate a public URL for a file in the bucket
 */
export function getBucketFileUrl(fileKey: string): string {
  const config = getStorageConfig();
  const { bucketUrl } = config;
  const { host, bucket, protocol } = parseBucketUrl(bucketUrl);

  return `${protocol}//${host}/${bucket}/${fileKey}`;
}

// Crypto utility functions

async function sha256Hex(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest("SHA-256", encoder.encode(data));
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256HexBuffer(data: Buffer): Promise<string> {
  const buffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

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

async function hmacSha256Hex(key: ArrayBuffer, data: string): Promise<string> {
  const buffer = await hmacSha256(key, data);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

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
