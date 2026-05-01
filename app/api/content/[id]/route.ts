import { type NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import ContentModel from "@/lib/models/Content";

import { utapi } from "@/lib/uploadthing";

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

    // Delete from UploadThing if fileKey exists
    if (content.source?.fileKey) {
      try {
        console.log(
          `[Content DELETE] Deleting from UploadThing: ${content.source.fileKey}`,
        );
        await utapi.deleteFiles(content.source.fileKey);
      } catch (deleteError) {
        console.error("UploadThing delete error:", deleteError);
        // Continue with database deletion even if UploadThing fails
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
