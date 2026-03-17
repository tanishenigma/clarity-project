import { type NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import ContentModel from "@/lib/models/Content";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const cloudinary = require("cloudinary").v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// DELETE - Remove content
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    if (!id || id.length !== 24 || !/^[0-9a-f]{24}$/i.test(id)) {
      return NextResponse.json(
        { error: "Invalid content ID format" },
        { status: 400 },
      );
    }

    await connectDB();
    const content = await ContentModel.findById(id).lean();

    if (!content) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }

    // Delete from Cloudinary if cloudinaryId exists
    if (content.source?.cloudinaryId) {
      try {
        // Derive Cloudinary resource_type from our content type
        // "auto" is only valid for uploads — destroy() requires the actual type
        const resourceType =
          content.type === "image"
            ? "image"
            : content.type === "video" || content.type === "audio"
              ? "video"
              : "raw"; // pdf, text, handwritten → raw
        console.log(
          `[Content DELETE] Deleting from Cloudinary: ${content.source.cloudinaryId} (resource_type: ${resourceType})`,
        );
        await cloudinary.uploader.destroy(content.source.cloudinaryId, {
          resource_type: resourceType,
        });
      } catch (cloudinaryError) {
        console.error("Cloudinary delete error:", cloudinaryError);
        // Continue with database deletion even if Cloudinary fails
      }
    }

    // Delete from database
    await ContentModel.deleteOne({ _id: id });

    return NextResponse.json({
      success: true,
      message: "Content deleted successfully",
    });
  } catch (error) {
    console.error("Delete content error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Delete failed" },
      { status: 500 },
    );
  }
}

// GET - Get content details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    if (!id || id.length !== 24 || !/^[0-9a-f]{24}$/i.test(id)) {
      return NextResponse.json(
        { error: "Invalid content ID format" },
        { status: 400 },
      );
    }

    await connectDB();
    const content = await ContentModel.findById(id).lean();

    if (!content) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }

    return NextResponse.json(content);
  } catch (error) {
    console.error("Get content error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to get content",
      },
      { status: 500 },
    );
  }
}
