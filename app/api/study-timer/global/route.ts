import { type NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getCurrentStudyDay } from "@/lib/utils/timer-utils";
import StudySessionModel from "@/lib/models/StudySession";
import DailyStudyStatsModel from "@/lib/models/DailyStudyStats";
import type { GlobalTimerUser } from "@/lib/types/study-timer";

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const studyDay = getCurrentStudyDay();
    const now = new Date();

    // Get all active sessions with user info
    const activeSessions = await StudySessionModel.aggregate([
      {
        $match: {
          isActive: true,
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $unwind: "$user",
      },
      {
        $lookup: {
          from: "daily_study_stats",
          let: { userId: "$userId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$userId", "$$userId"] },
                    { $eq: ["$date", studyDay] },
                  ],
                },
              },
            },
          ],
          as: "stats",
        },
      },
      {
        $project: {
          userId: { $toString: "$userId" },
          userName: "$user.username",
          userAvatar: "$user.avatar",
          startTime: "$startTime",
          isActive: "$isActive",
          todayTotal: {
            $ifNull: [{ $arrayElemAt: ["$stats.totalDuration", 0] }, 0],
          },
        },
      },
      {
        $limit: 100,
      },
    ]);

    // Calculate current duration for each active session
    const globalUsers: GlobalTimerUser[] = activeSessions.map(
      (session: any) => ({
        userId: session.userId,
        userName: session.userName || "Anonymous",
        userAvatar: session.userAvatar,
        currentSessionDuration: Math.floor(
          (now.getTime() - new Date(session.startTime).getTime()) / 1000,
        ),
        todayTotalDuration: session.todayTotal || 0,
        isActive: session.isActive,
        startTime: session.startTime,
      }),
    );

    // Get today's leaderboard (top 20)
    const leaderboard = await DailyStudyStatsModel.aggregate([
      {
        $match: {
          date: studyDay,
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $unwind: "$user",
      },
      {
        $project: {
          userId: { $toString: "$userId" },
          userName: "$user.username",
          userAvatar: "$user.avatar",
          totalDuration: "$totalDuration",
          sessionCount: "$sessionCount",
          longestSession: "$longestSession",
        },
      },
      {
        $sort: { totalDuration: -1 },
      },
      {
        $limit: 20,
      },
    ]);

    return NextResponse.json({
      activeUsers: globalUsers,
      activeCount: globalUsers.length,
      leaderboard,
      date: studyDay,
    });
  } catch (error) {
    console.error("Get global timer error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to get global data",
      },
      { status: 500 },
    );
  }
}
