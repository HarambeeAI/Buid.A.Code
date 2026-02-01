import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { uploadToBucket, getBucketFileUrl } from "@/lib/storage";

const UuidSchema = z.string().uuid();

/**
 * POST /api/admin/codes/:id/upload
 * Upload a building code PDF to storage and update source_document_url.
 * Admin only (protected by middleware).
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const idValidation = UuidSchema.safeParse(id);
    if (!idValidation.success) {
      return NextResponse.json(
        { error: "Bad Request", message: "Invalid code ID" },
        { status: 400 }
      );
    }

    // Check if code exists
    const code = await prisma.buildingCode.findUnique({
      where: { id },
    });

    if (!code) {
      return NextResponse.json(
        { error: "Not Found", message: "Building code not found" },
        { status: 404 }
      );
    }

    // Get the uploaded file from form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "Bad Request", message: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Bad Request", message: "Only PDF files are allowed" },
        { status: 400 }
      );
    }

    // Validate file size (max 100MB)
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "Bad Request", message: "File size must be less than 100MB" },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Generate file key
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const fileKey = `codes/${id}/${timestamp}_${sanitizedName}`;

    // Upload to bucket
    await uploadToBucket(fileKey, buffer, "application/pdf");

    // Get the public URL
    const publicUrl = getBucketFileUrl(fileKey);

    // Update the building code with the source document URL
    await prisma.buildingCode.update({
      where: { id },
      data: { source_document_url: publicUrl },
    });

    return NextResponse.json({
      success: true,
      file_key: fileKey,
      url: publicUrl,
      size: file.size,
      name: file.name,
    });
  } catch (error) {
    console.error("Error uploading code document:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to upload document" },
      { status: 500 }
    );
  }
}
