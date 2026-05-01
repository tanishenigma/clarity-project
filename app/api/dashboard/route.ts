import { type NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getUserActivity } from "@/lib/services/activity";
import UserModel from "@/lib/models/User";
import SpaceModel from "@/lib/models/Space";
import FlashcardModel from "@/lib/models/Flashcard";
import QuizModel from "@/lib/models/Quiz";
import UserStreakModel from "@/lib/models/UserStreak";
import StudySessionModel from "@/lib/models/StudySession";

// GET - Fetch dashboard stats for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    await connectDB();

    // Get user data
    const user = await UserModel.findById(userId).lean();

    // Get spaces
    const spaces = await SpaceModel.find({ userId })
      .sort({ updatedAt: -1 })
      .limit(5)
      .lean();

    // Get spaces with progress
    const spacesWithProgress = await Promise.all(
      spaces.map(async (space) => {
        const [flashcardCount, masteredCount] = await Promise.all([
          FlashcardModel.countDocuments({ spaceId: space._id }),
          FlashcardModel.countDocuments({
            spaceId: space._id,
            "reviewStats.correctCount": { $gte: 3 },
          }),
        ]);

        const progress =
          flashcardCount > 0
            ? Math.round((masteredCount / flashcardCount) * 100)
            : 0;

        return {
          ...space,
          _id: space._id.toString(),
          progress,
        };
      }),
    );

    // Get due flashcards count
    const dueFlashcardsCount = await FlashcardModel.countDocuments({
      userId,
      "reviewStats.nextReviewAt": { $lte: new Date() },
    });

    // Get recent quizzes
    const recentQuizzes = await QuizModel.find({ userId })
      .sort({ generatedAt: -1 })
      .limit(3)
      .lean();

    // Get study streak from user_streaks collection
    const streakDoc = await UserStreakModel.findOne({ userId }).lean();

    let streak = 0;
    if (streakDoc) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split("T")[0];
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];

      // Streak is valid if last activity was today or yesterday
      if (
        streakDoc.lastActivityDate === todayStr ||
        streakDoc.lastActivityDate === yesterdayStr
      ) {
        streak = streakDoc.currentStreak || 0;
      }
    }

    // Fallback: Calculate from study_sessions if no streak doc
    if (streak === 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const sessions = await StudySessionModel.find({
        userId,
        startedAt: {
          $gte: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000),
        },
      }).lean();

      const checkDate = new Date(today);
      while (true) {
        const dayStart = new Date(checkDate);
        const dayEnd = new Date(checkDate.getTime() + 24 * 60 * 60 * 1000);
        const hasSession = sessions.some(
          (s) => s.startedAt && s.startedAt >= dayStart && s.startedAt < dayEnd,
        );
        if (!hasSession && checkDate < today) break;
        if (hasSession) streak++;
        checkDate.setDate(checkDate.getDate() - 1);
        if (checkDate < new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000))
          break;
      }
    }

    // Total study time from sessions
    const sessions = await StudySessionModel.find({ userId }).lean();

    // Total study time
    const totalStudyMinutes = sessions.reduce(
      (acc, s) => acc + (s.durationMinutes || 0),
      0,
    );

    // Topics mastered
    const allFlashcards = await FlashcardModel.find({ userId }).lean();
    const masteredTopics = new Set(
      allFlashcards
        .filter((f) => (f.reviewStats?.correctCount || 0) >= 3)
        .flatMap((f) => f.tags || []),
    );

    const activityHistory = await getUserActivity(userId);

    return NextResponse.json({
      user: user
        ? {
            id: user._id.toString(),
            username: user.username,
            email: user.email,
          }
        : null,
      stats: {
        studyStreak: streak,
        totalStudyHours: Math.round(totalStudyMinutes / 60),
        topicsMastered: masteredTopics.size,
        totalTopics: new Set(allFlashcards.flatMap((f) => f.tags || [])).size,
        dueFlashcards: dueFlashcardsCount,
      },
      recentSpaces: spacesWithProgress,
      recentQuizzes: recentQuizzes.map((q) => ({
        _id: q._id.toString(),
        title: q.title,
        difficulty: q.difficulty,
        questionCount: q.questions?.length || 0,
      })),
      activity: activityHistory,
    });
  } catch (error) {
    console.error("Error fetching dashboard:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard" },
      { status: 500 },
    );
  }
}

// POST - Record study session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, spaceId, durationMinutes, activity } = body;

    if (!userId || !durationMinutes) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    await connectDB();

    await StudySessionModel.create({
      userId,
      spaceId: spaceId || null,
      durationMinutes,
      activity: activity || "general",
      startedAt: new Date(Date.now() - durationMinutes * 60 * 1000),
      endTime: new Date(),
    });

    // Update user's total study minutes
    await UserModel.updateOne(
      { _id: userId },
      { $inc: { totalStudyMinutes: durationMinutes } },
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error recording session:", error);
    return NextResponse.json(
      { error: "Failed to record session" },
      { status: 500 },
    );
  }
}
