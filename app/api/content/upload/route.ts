import { type NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { ContentIngestionAgent } from "@/lib/agents/content-agent";
import ContentModel from "@/lib/models/Content";
import { getUploadsRoot } from "@/lib/utils/storage";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

// Allow up to 2 minutes for large file uploads
export const maxDuration = 120;

interface LocalUploadResult {
  secure_url: string;
  public_id: string;
}

// Save file to local disk and return a local URL
async function saveFileLocally(
  file: File,
  userId: string,
  spaceId: string,
): Promise<LocalUploadResult> {
  console.log(
    `[Upload/Local] Saving: "${file.name}" (${(file.size / 1024).toFixed(1)} KB, type: ${file.type})`,
  );

  const ext = path.extname(file.name) || "";
  const filename = `${crypto.randomUUID()}${ext}`;
  const relativeKey = `${userId}/${spaceId}/${filename}`;
  const uploadsRoot = await getUploadsRoot(userId);
  const absolutePath = path.join(uploadsRoot, userId, spaceId, filename);

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(absolutePath, buffer);

  console.log(`[Upload/Local] Saved to: ${absolutePath}`);
  return {
    secure_url: `/api/files/${relativeKey}`,
    public_id: relativeKey,
  };
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

    // Save to local disk
    const uploadResult = await saveFileLocally(file, userId, spaceId);

    console.log("[Upload] Connecting to DB…");
    await connectDB();

    // Create content document with UploadThing URL
    console.log("[Upload] Creating ContentModel document…");
    const contentDoc = await ContentModel.create({
      spaceId,
      userId,
      type: detectedType,
      title: title || file.name,
      description: description || "",
      source: {
        fileKey: uploadResult.public_id,
        url: uploadResult.secure_url,
        mimeType: file.type,
        size: file.size,
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
    // Pass the file buffer directly so the agent doesn't need to re-fetch from UploadThing
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    processContentAsync(contentId, fileBuffer);

    console.log(`[Upload] ✓ Returning 201 success for contentId: ${contentId}`);
    return NextResponse.json(
      {
        success: true,
        contentId,
        url: uploadResult.secure_url,
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
async function processContentAsync(contentId: string, fileBuffer?: Buffer) {
  console.log(`[Upload/Async] Processing started for contentId: ${contentId}`);
  try {
    const contentAgent = new ContentIngestionAgent();
    await contentAgent.processContent(contentId, fileBuffer);
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
