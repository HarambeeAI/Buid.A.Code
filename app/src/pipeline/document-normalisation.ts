import { PrismaClient, DocumentType, AnalysisStatus } from "@prisma/client";
import { fetchFromBucket, uploadToBucket } from "../lib/storage";
import sharp from "sharp";

/**
 * Document Normalisation Pipeline (US-034)
 *
 * Responsible for:
 * 1. Fetching documents from Buckets
 * 2. Converting PDFs to 300 DPI PNG images + extracting text
 * 3. Normalising images (PNG/JPG/TIFF) to PNG format
 * 4. Splitting multi-page TIFFs
 * 5. Storing normalised pages in Buckets under analysis prefix
 * 6. Updating current_stage during processing
 */

export interface NormalisedPage {
  pageNumber: number;
  imageKey: string;
  width: number;
  height: number;
  textContent?: string;
}

export interface NormalisationResult {
  pages: NormalisedPage[];
  totalPages: number;
}

const TARGET_DPI = 300;

/**
 * Main normalisation function
 * Fetches document, converts to normalised PNG pages, uploads to bucket
 */
export async function normaliseDocument(
  prisma: PrismaClient,
  analysisId: string,
  documentUrl: string,
  documentType: DocumentType,
  pageCount: number
): Promise<NormalisationResult> {
  console.log(`[Normalisation] Starting normalisation for analysis ${analysisId}`);
  console.log(`[Normalisation] Document type: ${documentType}, expected pages: ${pageCount}`);

  // Update stage
  await updateStage(prisma, analysisId, "Fetching document...");

  // Extract file key from URL
  const fileKey = extractFileKey(documentUrl);
  console.log(`[Normalisation] Fetching file: ${fileKey}`);

  // Fetch document from bucket
  const documentBuffer = await fetchFromBucket(fileKey);
  console.log(`[Normalisation] Fetched ${documentBuffer.length} bytes`);

  // Update stage
  await updateStage(prisma, analysisId, "Normalising document...");

  let pages: NormalisedPage[];

  switch (documentType) {
    case "PDF":
      pages = await normalisePdf(prisma, analysisId, documentBuffer, pageCount);
      break;
    case "PNG":
    case "JPG":
      pages = await normaliseImage(prisma, analysisId, documentBuffer, documentType);
      break;
    case "TIFF":
      pages = await normaliseTiff(prisma, analysisId, documentBuffer);
      break;
    default:
      throw new Error(`Unsupported document type: ${documentType}`);
  }

  console.log(`[Normalisation] Completed: ${pages.length} pages normalised`);

  return {
    pages,
    totalPages: pages.length,
  };
}

/**
 * Normalise a PDF document
 * Converts each page to 300 DPI PNG and extracts text
 */
async function normalisePdf(
  prisma: PrismaClient,
  analysisId: string,
  pdfBuffer: Buffer,
  expectedPages: number
): Promise<NormalisedPage[]> {
  console.log(`[Normalisation] Processing PDF with ${expectedPages} expected pages`);

  // Dynamic import for pdf-to-img (ESM module)
  const { pdf } = await import("pdf-to-img");

  const pages: NormalisedPage[] = [];
  let pageNumber = 0;

  // pdf-to-img returns an async iterable of page images
  const document = await pdf(pdfBuffer, {
    scale: TARGET_DPI / 72, // PDF default is 72 DPI, scale to 300 DPI
  });

  for await (const pageImage of document) {
    pageNumber++;
    await updateStage(prisma, analysisId, `Normalising page ${pageNumber} of ${expectedPages}...`);

    // pageImage is a Buffer of PNG data
    const pngBuffer = Buffer.from(pageImage);

    // Get image dimensions using sharp
    const metadata = await sharp(pngBuffer).metadata();

    // Upload to bucket
    const imageKey = `analyses/${analysisId}/pages/page-${String(pageNumber).padStart(4, "0")}.png`;
    await uploadToBucket(imageKey, pngBuffer, "image/png");

    pages.push({
      pageNumber,
      imageKey,
      width: metadata.width || 0,
      height: metadata.height || 0,
      // Note: Text extraction would require a separate PDF parsing library
      // For now, we'll rely on Gemini vision for text extraction
    });

    console.log(`[Normalisation] Page ${pageNumber} processed: ${metadata.width}x${metadata.height}`);
  }

  return pages;
}

/**
 * Normalise a single image (PNG/JPG)
 * Converts to PNG format if needed
 */
async function normaliseImage(
  prisma: PrismaClient,
  analysisId: string,
  imageBuffer: Buffer,
  documentType: DocumentType
): Promise<NormalisedPage[]> {
  console.log(`[Normalisation] Processing ${documentType} image`);
  await updateStage(prisma, analysisId, "Normalising image...");

  // Convert to PNG using sharp (handles JPG -> PNG conversion)
  const pngBuffer = await sharp(imageBuffer)
    .png()
    .toBuffer();

  const metadata = await sharp(pngBuffer).metadata();

  // Upload to bucket
  const imageKey = `analyses/${analysisId}/pages/page-0001.png`;
  await uploadToBucket(imageKey, pngBuffer, "image/png");

  console.log(`[Normalisation] Image processed: ${metadata.width}x${metadata.height}`);

  return [
    {
      pageNumber: 1,
      imageKey,
      width: metadata.width || 0,
      height: metadata.height || 0,
    },
  ];
}

/**
 * Normalise a TIFF document
 * Handles multi-page TIFFs by splitting into individual PNGs
 */
async function normaliseTiff(
  prisma: PrismaClient,
  analysisId: string,
  tiffBuffer: Buffer
): Promise<NormalisedPage[]> {
  console.log(`[Normalisation] Processing TIFF image`);

  const pages: NormalisedPage[] = [];

  // Sharp can read multi-page TIFFs using the page option
  // First, get metadata to find total pages
  const metadata = await sharp(tiffBuffer).metadata();
  const totalPages = metadata.pages || 1;

  console.log(`[Normalisation] TIFF has ${totalPages} page(s)`);

  for (let page = 0; page < totalPages; page++) {
    const pageNumber = page + 1;
    await updateStage(prisma, analysisId, `Normalising TIFF page ${pageNumber} of ${totalPages}...`);

    // Extract specific page from TIFF
    const pngBuffer = await sharp(tiffBuffer, { page })
      .png()
      .toBuffer();

    const pageMetadata = await sharp(pngBuffer).metadata();

    // Upload to bucket
    const imageKey = `analyses/${analysisId}/pages/page-${String(pageNumber).padStart(4, "0")}.png`;
    await uploadToBucket(imageKey, pngBuffer, "image/png");

    pages.push({
      pageNumber,
      imageKey,
      width: pageMetadata.width || 0,
      height: pageMetadata.height || 0,
    });

    console.log(`[Normalisation] TIFF page ${pageNumber} processed: ${pageMetadata.width}x${pageMetadata.height}`);
  }

  return pages;
}

/**
 * Extract file key from document URL
 */
function extractFileKey(documentUrl: string): string {
  // Document URL format: https://bucket.host/bucket-name/uploads/user-id/timestamp-file.ext
  // We need to extract the path after the bucket name
  const url = new URL(documentUrl);
  const pathParts = url.pathname.split("/").filter(Boolean);

  // First part is bucket name, rest is file key
  if (pathParts.length < 2) {
    throw new Error(`Invalid document URL format: ${documentUrl}`);
  }

  return pathParts.slice(1).join("/");
}

/**
 * Update analysis current_stage
 */
async function updateStage(
  prisma: PrismaClient,
  analysisId: string,
  stage: string
): Promise<void> {
  await prisma.analysis.update({
    where: { id: analysisId },
    data: { current_stage: stage },
  });
}
