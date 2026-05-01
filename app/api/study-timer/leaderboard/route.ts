import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import StudyTimerModel from "@/lib/models/StudyTimer";
import StudyTimerHistoryModel from "@/lib/models/StudyTimerHistory";

/**
 * Leaderboard API for Study Timer
 * Shows global rankings for today, this week, and this month
 */

// Helper to get today's date key (resets at 5:30 AM IST)
function getTodayKey(): string {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);

  if (
    istTime.getHours() < 5 ||
    (istTime.getHours() === 5 && istTime.getMinutes() < 30)
  ) {
    istTime.setDate(istTime.getDate() - 1);
  }

  return istTime.toISOString().split("T")[0];
}

function getWeekStart(): string {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);

  // Adjust for 5:30 AM reset
  if (
    istTime.getHours() < 5 ||
    (istTime.getHours() === 5 && istTime.getMinutes() < 30)
  ) {
    istTime.setDate(istTime.getDate() - 1);
  }

  const dayOfWeek = istTime.getDay();
  const diff = istTime.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const weekStart = new Date(istTime.setDate(diff));

  return weekStart.toISOString().split("T")[0];
}

function getMonthStart(): string {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);

  if (
    istTime.getHours() < 5 ||
    (istTime.getHours() === 5 && istTime.getMinutes() < 30)
  ) {
    istTime.setDate(istTime.getDate() - 1);
  }

  return `${istTime.getFullYear()}-${String(istTime.getMonth() + 1).padStart(2, "0")}-01`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "today";

    await connectDB();
    let leaderboard: any[] = [];

    if (period === "today") {
      const todayKey = getTodayKey();

      leaderboard = await StudyTimerModel.aggregate([
        { $match: { dateKey: todayKey } },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            userId: "$userId",
            userName: { $ifNull: ["$user.name", "$user.email"] },
            todayTime: "$totalSeconds",
            weekTime: 0,
            monthTime: 0,
          },
        },
        { $sort: { todayTime: -1 } },
        { $limit: 100 },
      ]);
    } else if (period === "week") {
      const weekStart = getWeekStart();

      leaderboard = await StudyTimerHistoryModel.aggregate([
        { $match: { dateKey: { $gte: weekStart } } },
        {
          $group: {
            _id: "$userId",
            weekTime: { $sum: "$seconds" },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            userId: "$_id",
            userName: { $ifNull: ["$user.name", "$user.email"] },
            todayTime: 0,
            weekTime: "$weekTime",
            monthTime: 0,
          },
        },
        { $sort: { weekTime: -1 } },
        { $limit: 100 },
      ]);
    } else if (period === "month") {
      const monthStart = getMonthStart();

      leaderboard = await StudyTimerHistoryModel.aggregate([
        { $match: { dateKey: { $gte: monthStart } } },
        {
          $group: {
            _id: "$userId",
            monthTime: { $sum: "$seconds" },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            userId: "$_id",
            userName: { $ifNull: ["$user.name", "$user.email"] },
            todayTime: 0,
            weekTime: 0,
            monthTime: "$monthTime",
          },
        },
        { $sort: { monthTime: -1 } },
        { $limit: 100 },
      ]);
    }

    // Add ranks
    const rankedLeaderboard = leaderboard.map((entry, index) => ({
      ...entry,
      userId: entry.userId.toString(),
      rank: index + 1,
    }));

    return NextResponse.json({ leaderboard: rankedLeaderboard });
  } catch (error) {
    console.error("Leaderboard error:", error);
    return NextResponse.json(
      { error: "Failed to fetch leaderboard" },
      { status: 500 },
    );
  }
}
