import { type NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { ContentIngestionAgent } from "@/lib/agents/content-agent";
import ContentModel from "@/lib/models/Content";

// Allow up to 2 minutes for large file uploads + Cloudinary processing
export const maxDuration = 120;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const cloudinary = require("cloudinary").v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  bytes: number;
  format: string;
  resource_type: string;
}

// Upload file to Cloudinary using upload_stream (avoids base64 inflation)
async function uploadToCloudinary(
  file: File,
  spaceId: string,
): Promise<CloudinaryUploadResult> {
  console.log(
    `[Upload/Cloudinary] Starting upload: "${file.name}" (${(file.size / 1024).toFixed(1)} KB, type: ${file.type})`,
  );
  const buffer = Buffer.from(await file.arrayBuffer());

  return new Promise<CloudinaryUploadResult>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `ai-tutor-spaces/${spaceId}`,
        resource_type: "auto",
        public_id: `content_${Date.now()}_${file.name.replace(/\.[^/.]+$/, "")}`,
      },
      (error: unknown, result: CloudinaryUploadResult | undefined) => {
        if (error || !result) {
          console.error("[Upload/Cloudinary] upload_stream error:", error);
          reject(error ?? new Error("Cloudinary returned no result"));
        } else {
          console.log(
            `[Upload/Cloudinary] Upload successful — public_id: ${result.public_id}, url: ${result.secure_url}`,
          );
          resolve(result);
        }
      },
    );
    stream.end(buffer);
  });
}

export async function POST(request: NextRequest) {
  console.log("[Upload] POST /api/content/upload — request received");
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const spaceId = formData.get("spaceId") as string;
    const userId = formData.get("userId") as string;
    const contentType = formData.get("contentType") as string;

    console.log(
      `[Upload] Fields — spaceId: ${spaceId}, userId: ${userId}, file: ${file?.name ?? "(none)"}, title: "${title}"`,
    );

    if (!file || !spaceId || !userId) {
      const missing = [
        !file && "file",
        !spaceId && "spaceId",
        !userId && "userId",
      ]
        .filter(Boolean)
        .join(", ");
      console.warn(`[Upload] Missing required fields: ${missing}`);
      return NextResponse.json(
        { error: `Missing required fields: ${missing}` },
        { status: 400 },
      );
    }

    // Determine content type from file
    let detectedType = contentType || "text";
    if (file.type.startsWith("image/")) detectedType = "image";
    else if (file.type === "application/pdf") detectedType = "pdf";
    else if (file.type.startsWith("audio/")) detectedType = "audio";
    else if (file.type.startsWith("video/")) detectedType = "video";
    console.log(
      `[Upload] Detected content type: ${detectedType} (MIME: ${file.type})`,
    );

    // Upload to Cloudinary
    const cloudinaryResult = await uploadToCloudinary(file, spaceId);

    console.log("[Upload] Connecting to DB…");
    await connectDB();

    // Create content document with Cloudinary URL
    console.log("[Upload] Creating ContentModel document…");
    const contentDoc = await ContentModel.create({
      spaceId,
      userId,
      type: detectedType,
      title: title || file.name,
      description: description || "",
      source: {
        fileKey: cloudinaryResult.public_id,
        url: cloudinaryResult.secure_url,
        mimeType: file.type,
        size: file.size,
        cloudinaryId: cloudinaryResult.public_id,
        uploadedAt: new Date(),
      },
      processingStatus: "pending" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const contentId = contentDoc._id.toString();
    console.log(`[Upload] ContentModel created — contentId: ${contentId}`);

    // Queue content ingestion (async, non-blocking)
    console.log(
      `[Upload] Queuing async processing for contentId: ${contentId}`,
    );
    processContentAsync(contentId);

    console.log(`[Upload] ✓ Returning 201 success for contentId: ${contentId}`);
    return NextResponse.json(
      {
        success: true,
        contentId,
        url: cloudinaryResult.secure_url,
        message: "Content uploaded successfully. Processing has started.",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[Upload] ✗ Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 },
    );
  }
}

// Async processing outside request scope
async function processContentAsync(contentId: string) {
  console.log(`[Upload/Async] Processing started for contentId: ${contentId}`);
  try {
    const contentAgent = new ContentIngestionAgent();
    await contentAgent.processContent(contentId);
    console.log(
      `[Upload/Async] ✓ Processing complete for contentId: ${contentId}`,
    );
  } catch (error) {
    console.error(
      `[Upload/Async] ✗ Processing failed for contentId: ${contentId}`,
      error,
    );
  }
}
