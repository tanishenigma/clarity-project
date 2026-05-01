/**
 * Learning Spaces API Route
 * POST /api/learning/spaces - Create a new learning space
 * GET /api/learning/spaces?userId={id} - Get all user's learning spaces
 */

import { type NextRequest, NextResponse } from "next/server";
import { learningSpaceService } from "@/lib/services/learning-space-service";
import { connectDB } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { userId, topic, pdfSource } = await request.json();

    if (!userId || !topic) {
      return NextResponse.json(
        { error: "Missing required fields: userId, topic" },
        { status: 400 },
      );
    }

    const newSpace = await learningSpaceService.createLearningSpace({
      userId,
      topic,
      pdfSource,
    });

    return NextResponse.json({
      success: true,
      learningSpace: {
        id: newSpace._id?.toString(),
        topic: newSpace.topic,
        status: newSpace.status,
        createdAt: newSpace.createdAt,
      },
    });
  } catch (error) {
    console.error("Error creating learning space:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create learning space",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const userId = request.nextUrl.searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "Missing userId parameter" },
        { status: 400 },
      );
    }

    const spaces = await learningSpaceService.getUserLearningSpaces(userId);

    return NextResponse.json({
      success: true,
      spaces: spaces.map((space) => ({
        id: space._id?.toString(),
        topic: space.topic,
        status: space.status,
        createdAt: space.createdAt,
        updatedAt: space.updatedAt,
        hasSummary: !!space.summaryNotes,
        hasQuiz: !!space.quiz,
        hasRecommendations: !!space.recommendations,
        hasMindmap: !!space.mindmap,
        hasAudio: !!space.audioScript,
      })),
    });
  } catch (error) {
    console.error("Error fetching learning spaces:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch learning spaces",
      },
      { status: 500 },
    );
  }
}
