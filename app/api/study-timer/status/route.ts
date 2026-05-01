import { type NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getCurrentStudyDay } from "@/lib/utils/timer-utils";
import StudySessionModel from "@/lib/models/StudySession";
import DailyStudyStatsModel from "@/lib/models/DailyStudyStats";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    await connectDB();
    const studyDay = getCurrentStudyDay();

    // 1. Get today's total stats
    const stats = await DailyStudyStatsModel.findOne({
      userId,
      date: studyDay,
    }).lean();

    const todayTotal = stats?.totalDuration || 0;

    // 2. Check if there is currently an active session
    const activeSession = await StudySessionModel.findOne({
      userId,
      isActive: true,
    }).lean();

    let currentDuration = 0;
    let sessionId = null;

    if (activeSession) {
      sessionId = activeSession._id.toString();
      // Calculate how long this specific session has been running
      const now = new Date();
      const startTime = new Date(activeSession.startTime);
      currentDuration = Math.floor(
        (now.getTime() - startTime.getTime()) / 1000,
      );
    }

    return NextResponse.json({
      isActive: !!activeSession,
      sessionId,
      currentDuration,
      todayTotal, // This will now include the data saved in your Stop handler
    });
  } catch (error) {
    console.error("Status fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch status" },
      { status: 500 },
    );
  }
}
