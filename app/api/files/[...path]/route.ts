import { type NextRequest, NextResponse } from "next/server";
import { getAuthJwt } from "@/lib/auth";
import { getUploadsRoot } from "@/lib/utils/storage";
import fs from "fs/promises";
import path from "path";

// Serve locally stored files with ownership check
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const session = await getAuthJwt();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { path: segments } = await params;

    // Path structure: [userId, spaceId, filename]
    if (!segments || segments.length < 3) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
    }

    // Ownership check: first segment must match the authenticated user
    const fileUserId = segments[0];
    if (session.userId !== fileUserId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Prevent path traversal: ensure no segment contains ".."
    for (const segment of segments) {
      if (segment.includes("..") || segment.includes("/")) {
        return NextResponse.json(
          { error: "Invalid file path" },
          { status: 400 },
        );
      }
    }

    // Resolve uploads root for this user (respects custom folder setting)
    const uploadsRoot = await getUploadsRoot(session.userId);

    const absolutePath = path.join(uploadsRoot, ...segments);
    // Ensure the resolved path stays within the uploads root
    if (!absolutePath.startsWith(uploadsRoot + path.sep)) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
    }

    let fileBuffer: Buffer;
    try {
      fileBuffer = await fs.readFile(absolutePath);
    } catch {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const filename = segments[segments.length - 1];
    const ext = path.extname(filename).toLowerCase();
    const mimeMap: Record<string, string> = {
      ".pdf": "application/pdf",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".mp3": "audio/mpeg",
      ".mp4": "video/mp4",
      ".wav": "audio/wav",
      ".txt": "text/plain",
      ".doc": "application/msword",
      ".docx":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
    const contentType = mimeMap[ext] ?? "application/octet-stream";

    // Copy into a clean ArrayBuffer to satisfy TypeScript DOM types
    const arrayBuffer = fileBuffer.buffer.slice(
      fileBuffer.byteOffset,
      fileBuffer.byteOffset + fileBuffer.byteLength,
    ) as ArrayBuffer;

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": fileBuffer.length.toString(),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[Files GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to serve file" },
      { status: 500 },
    );
  }
}
