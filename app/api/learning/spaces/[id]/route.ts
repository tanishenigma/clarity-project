/**
 * Individual Learning Space API Route
 * GET /api/learning/spaces/[id] - Get a specific learning space with all results
 * DELETE /api/learning/spaces/[id] - Delete a learning space
 */

import { type NextRequest, NextResponse } from "next/server";
import { learningSpaceService } from "@/lib/services/learning-space-service";
import { connectDB } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id } = await params;

    const space = await learningSpaceService.getLearningSpace(id);

    if (!space) {
      return NextResponse.json(
        { error: "Learning space not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      learningSpace: {
        id: space._id?.toString(),
        topic: space.topic,
        pdfSource: space.pdfSource,
        status: space.status,
        createdAt: space.createdAt,
        updatedAt: space.updatedAt,
        results: {
          summaryNotes: space.summaryNotes,
          quiz: space.quiz,
          recommendations: space.recommendations,
          mindmap: space.mindmap,
          audioScript: space.audioScript,
          audioOverview: space.audioOverview,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching learning space:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch learning space",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id } = await params;

    await learningSpaceService.deleteLearningSpace(id);

    return NextResponse.json({
      success: true,
      message: "Learning space deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting learning space:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete learning space",
      },
      { status: 500 },
    );
  }
}
