import { type NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import StudySessionModel from "@/lib/models/StudySession";
import DailyStudyStatsModel from "@/lib/models/DailyStudyStats";
import { recordActivity } from "@/lib/services/activity";

export async function POST(request: NextRequest) {
  try {
    const { userId, sessionId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    await connectDB();
    const now = new Date();

    // Find active session
    const query: Record<string, unknown> = {
      userId,
      isActive: true,
    };
    if (sessionId) query._id = sessionId;

    const session = await StudySessionModel.findOne(query).lean();

    if (!session) {
      return NextResponse.json(
        { error: "No active session found" },
        { status: 404 },
      );
    }

    // Calculate duration
    const duration = Math.floor(
      (now.getTime() - new Date(session.startTime).getTime()) / 1000,
    );

    // Update session
    await StudySessionModel.updateOne(
      { _id: session._id },
      {
        $set: {
          endTime: now,
          duration,
          isActive: false,
          updatedAt: now,
        },
      },
    );

    // Update daily stats — upsert in case start() failed to create the record
    await DailyStudyStatsModel.updateOne(
      {
        userId,
        date: session.date,
      },
      {
        $inc: {
          totalDuration: duration,
        },
        $max: {
          longestSession: duration,
        },
        $set: {
          updatedAt: now,
        },
        $setOnInsert: {
          userId,
          date: session.date,
          sessionCount: 1,
          createdAt: now,
        },
      },
      { upsert: true },
    );

    // Record activity for the heatmap calendar (1 unit per 30 min studied)
    const studyMinutes = Math.round(duration / 60);
    await recordActivity(userId, "study", session.date, studyMinutes);

    return NextResponse.json({
      message: "Study session stopped",
      duration,
      sessionId: session._id.toString(),
    });
  } catch (error) {
    console.error("Stop timer error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to stop timer",
      },
      { status: 500 },
    );
  }
}
