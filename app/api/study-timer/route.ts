import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import StudyTimerModel from "@/lib/models/StudyTimer";
import StudyTimerHistoryModel from "@/lib/models/StudyTimerHistory";

/**
 * Study Timer API
 * Handles timer sessions with 5:30 AM IST daily reset
 * Timer NEVER resets when stopped - only accumulates and resets at 5:30 AM IST
 */

// Helper to get today's date key (resets at 5:30 AM IST)
function getTodayKey(): string {
  const now = new Date();

  // Convert to IST (UTC+5:30)
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);

  // If before 5:30 AM IST, use previous day
  if (
    istTime.getHours() < 5 ||
    (istTime.getHours() === 5 && istTime.getMinutes() < 30)
  ) {
    istTime.setDate(istTime.getDate() - 1);
  }

  return istTime.toISOString().split("T")[0];
}

// GET: Fetch user's timer status and today's total
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    await connectDB();
    const todayKey = getTodayKey();

    const timerData = await StudyTimerModel.findOne({
      userId,
      dateKey: todayKey,
    }).lean();

    return NextResponse.json({
      todayTotal: timerData?.totalSeconds || 0,
      dateKey: todayKey,
      isActive: timerData?.isActive || false,
      sessionId: timerData?.sessionId || null,
      currentDuration: timerData?.currentDuration || 0,
    });
  } catch (error) {
    console.error("Timer GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch timer data" },
      { status: 500 },
    );
  }
}

// POST: Update timer (add seconds)
export async function POST(request: NextRequest) {
  try {
    const { userId, seconds, action } = await request.json();

    if (!userId || seconds === undefined) {
      return NextResponse.json(
        { error: "userId and seconds required" },
        { status: 400 },
      );
    }

    await connectDB();
    const todayKey = getTodayKey();

    if (action === "add") {
      // Add time to today's total
      await StudyTimerModel.updateOne(
        { userId, dateKey: todayKey },
        {
          $inc: { totalSeconds: seconds },
          $set: { lastUpdated: new Date(), isActive: false },
          $setOnInsert: { userId, dateKey: todayKey, createdAt: new Date() },
        },
        { upsert: true },
      );

      // Also store in history for weekly/monthly stats
      await StudyTimerHistoryModel.create({
        userId,
        dateKey: todayKey,
        seconds,
        timestamp: new Date(),
      });
    } else if (action === "start") {
      // Mark as active
      await StudyTimerModel.updateOne(
        { userId, dateKey: todayKey },
        {
          $set: { isActive: true, lastStarted: new Date() },
          $setOnInsert: {
            userId,
            dateKey: todayKey,
            totalSeconds: 0,
            createdAt: new Date(),
          },
        },
        { upsert: true },
      );
    }

    return NextResponse.json({ success: true, dateKey: todayKey });
  } catch (error) {
    console.error("Timer POST error:", error);
    return NextResponse.json(
      { error: "Failed to update timer" },
      { status: 500 },
    );
  }
}
