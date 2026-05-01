import { type NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import StudySessionModel from "@/lib/models/StudySession";
import type { StudySession } from "@/lib/types/study-timer";

/**
 * POST /api/study-timer/sync
 * Periodically called (every 30s) while a session is running
 * to persist the current duration for crash recovery.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, sessionId, currentDuration } = await request.json();

    if (!userId || !sessionId || currentDuration === undefined) {
      return NextResponse.json(
        { error: "userId, sessionId and currentDuration required" },
        { status: 400 },
      );
    }

    await connectDB();

    await StudySessionModel.updateOne(
      {
        _id: sessionId,
        userId,
        isActive: true,
      },
      {
        $set: {
          currentDuration,
          updatedAt: new Date(),
        },
      },
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Timer sync error:", error);
    return NextResponse.json(
      { error: "Failed to sync timer" },
      { status: 500 },
    );
  }
}
