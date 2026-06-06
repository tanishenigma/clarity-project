import { type NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { ContentIngestionAgent } from "@/lib/agents/content-agent";
import ContentModel from "@/lib/models/Content";
import { getUploadsRoot } from "@/lib/utils/storage";
import fs from "fs/promises";
import { createWriteStream } from "fs";
import path from "path";
import crypto from "crypto";
import busboy from "busboy";
import { Readable } from "stream";

// Allow up to 2 minutes for large file uploads
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  console.log("[Upload] POST /api/content/upload — request received (streaming)");

  // Import file-type dynamically as it is ESM-only
  const { fileTypeStream } = await import("file-type");

  return new Promise<NextResponse>((resolve) => {
    const headers = Object.fromEntries(request.headers.entries());
    const bb = busboy({ 
      headers,
      limits: { 
        fileSize: 20 * 1024 * 1024, // 20MB limit
        files: 1 
      } 
    });

    let spaceId: string;
    let userId: string;
    let title: string;
    let description: string;
    let contentType: string;
    
    let fileWritten = false;
    let uploadResult: { 
      public_id: string; 
      secure_url: string; 
      size: number; 
      mimeType: string;
      tmpPath?: string;
      ext?: string;
    };
    let errorSent = false;

    const sendError = (message: string, status = 400) => {
      if (errorSent) return;
      errorSent = true;
      console.warn(`[Upload] Rejecting request: ${message} (${status})`);
      resolve(NextResponse.json({ error: message }, { status }));
    };

    bb.on("field", (name, val) => {
      if (name === "spaceId") spaceId = val;
      if (name === "userId") userId = val;
      if (name === "title") title = val;
      if (name === "description") description = val;
      if (name === "contentType") contentType = val;
    });

    bb.on("file", async (name, fileStream) => {
      try {
        console.log(`[Upload] Processing file field: "${name}"`);
        
        // Use default uploads root for temporary storage
        const uploadsRoot = await getUploadsRoot(""); 
        const tmpDir = path.join(uploadsRoot, "tmp");
        await fs.mkdir(tmpDir, { recursive: true });

        // Validate file type using magic numbers via streaming
        const ftStream = await fileTypeStream(fileStream);
        const detected = ftStream.fileType;

        if (!detected) {
          fileStream.resume(); // Consume the stream to avoid hanging
          return sendError("Invalid file type: Magic numbers not recognized. Only standard documents and media are supported.");
        }

        console.log(`[Upload] Magic numbers validated: ${detected.mime} (.${detected.ext})`);

        // Randomized renaming with verified extension
        const ext = `.${detected.ext}`;
        const filename = `${crypto.randomUUID()}${ext}`;
        const tmpPath = path.join(tmpDir, filename);

        const writeStream = createWriteStream(tmpPath);
        let fileSize = 0;

        ftStream.on("data", (chunk: Buffer) => {
          fileSize += chunk.length;
        });

        ftStream.pipe(writeStream);

        // Handle size limit hit
        fileStream.on("limit", async () => {
          console.error(`[Upload] File size limit reached for ${filename}`);
          writeStream.destroy();
          await fs.unlink(tmpPath).catch(() => {});
          sendError("File size limit exceeded (max 20MB)", 413);
        });

        await new Promise((res, rej) => {
          writeStream.on("finish", res);
          writeStream.on("error", rej);
        });

        if (errorSent) return;

        uploadResult = {
          public_id: filename,
          secure_url: "", // To be filled after final move
          size: fileSize,
          mimeType: detected.mime,
          tmpPath,
          ext,
        };
        fileWritten = true;
        console.log(`[Upload] Streamed ${fileSize} bytes to temp storage`);

      } catch (err) {
        console.error("[Upload] File processing error:", err);
        sendError("File processing failed during streaming");
      }
    });

    bb.on("close", async () => {
      if (errorSent) return;

      if (!fileWritten || !uploadResult) {
        return sendError("No file uploaded or file processing failed");
      }

      if (!userId || !spaceId) {
        console.warn("[Upload] Missing metadata: userId or spaceId");
        if (uploadResult.tmpPath) {
          await fs.unlink(uploadResult.tmpPath).catch(() => {});
        }
        return sendError("Missing required fields: userId and spaceId must be provided");
      }

      try {
        // Resolve final destination
        const uploadsRoot = await getUploadsRoot(userId);
        const finalDir = path.join(uploadsRoot, userId, spaceId);
        await fs.mkdir(finalDir, { recursive: true });

        const finalFilename = uploadResult.public_id;
        const finalPath = path.join(finalDir, finalFilename);
        const relativeKey = `${userId}/${spaceId}/${finalFilename}`;

        // Move from tmp to final (cross-device safe move)
        await fs.copyFile(uploadResult.tmpPath!, finalPath);
        await fs.unlink(uploadResult.tmpPath!);
        
        // Strict storage isolation: Remove execution permissions
        await fs.chmod(finalPath, 0o644);
        console.log(`[Upload] File secured and moved to: ${finalPath}`);

        uploadResult.public_id = relativeKey;
        uploadResult.secure_url = `/api/files/${relativeKey}`;

        console.log("[Upload] Connecting to DB…");
        await connectDB();

        const detectedType = contentType || 
          (uploadResult.mimeType.startsWith("image/") ? "image" : 
           uploadResult.mimeType === "application/pdf" ? "pdf" : 
           uploadResult.mimeType.startsWith("audio/") ? "audio" :
           uploadResult.mimeType.startsWith("video/") ? "video" : "text");

        console.log("[Upload] Creating ContentModel document…");
        const contentDoc = await ContentModel.create({
          spaceId,
          userId,
          type: detectedType,
          title: title || "Untitled Content",
          description: description || "",
          source: {
            fileKey: uploadResult.public_id,
            url: uploadResult.secure_url,
            mimeType: uploadResult.mimeType,
            size: uploadResult.size,
            uploadedAt: new Date(),
          },
          processingStatus: "pending",
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const contentId = contentDoc._id.toString();
        console.log(`[Upload] ContentModel created — contentId: ${contentId}`);

        // Async processing using the secured file path (no re-buffering)
        processContentAsync(contentId, finalPath);

        resolve(NextResponse.json({
          success: true,
          contentId,
          url: uploadResult.secure_url,
          message: "Content uploaded successfully. Processing has started.",
        }, { status: 201 }));

      } catch (err) {
        console.error("[Upload] Finalization error:", err);
        sendError("Failed to finalize upload", 500);
      }
    });

    bb.on("error", (err) => {
      console.error("[Upload] Busboy error:", err);
      sendError("Upload stream encountered an error");
    });

    if (request.body) {
      // Convert Web Stream to Node Stream for Busboy
      Readable.fromWeb(request.body as any).pipe(bb);
    } else {
      sendError("Empty request body");
    }
  });
}

async function processContentAsync(contentId: string, fileSource?: Buffer | string) {
  console.log(`[Upload/Async] Processing started for contentId: ${contentId}`);
  try {
    const contentAgent = new ContentIngestionAgent();
    await contentAgent.processContent(contentId, fileSource);
    console.log(`[Upload/Async] ✓ Processing complete for contentId: ${contentId}`);
  } catch (error) {
    console.error(`[Upload/Async] ✗ Processing failed for contentId: ${contentId}`, error);
  }
}
