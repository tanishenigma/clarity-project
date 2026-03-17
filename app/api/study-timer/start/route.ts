import { type NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import {
  getCurrentStudyDay,
  getResetTimeForDate,
} from "@/lib/utils/timer-utils";
import StudySessionModel from "@/lib/models/StudySession";
import DailyStudyStatsModel from "@/lib/models/DailyStudyStats";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    await connectDB();
    const now = new Date();
    const studyDay = getCurrentStudyDay();

    // Check if there's already an active session
    const activeSession = await StudySessionModel.findOne({
      userId,
      isActive: true,
    }).lean();

    if (activeSession) {
      return NextResponse.json({
        message: "Session already active",
        session: activeSession,
      });
    }

    // Create new session
    const newSession = await StudySessionModel.create({
      userId,
      startTime: now,
      duration: 0,
      isActive: true,
      date: studyDay,
      createdAt: now,
      updatedAt: now,
    });

    // Initialize or get daily stats
    const resetAt = getResetTimeForDate(studyDay);
    await DailyStudyStatsModel.updateOne(
      {
        userId,
        date: studyDay,
      },
      {
        $setOnInsert: {
          userId,
          date: studyDay,
          totalDuration: 0,
          longestSession: 0,
          resetAt,
          createdAt: now,
        },
        $inc: {
          sessionCount: 1,
        },
        $set: {
          updatedAt: now,
        },
      },
      { upsert: true },
    );

    return NextResponse.json({
      message: "Study session started",
      sessionId: newSession._id.toString(),
      startTime: now,
      date: studyDay,
    });
  } catch (error) {
    console.error("Start timer error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to start timer",
      },
      { status: 500 },
    );
  }
}
