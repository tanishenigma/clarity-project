import { type NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getUserActivity } from "@/lib/services/activity";
import { format } from "date-fns";
import QuizModel from "@/lib/models/Quiz";
import UserActivityModel from "@/lib/models/UserActivity";
import DailyStudyStatsModel from "@/lib/models/DailyStudyStats";
import FlashcardModel from "@/lib/models/Flashcard";
import StudySessionModel from "@/lib/models/StudySession";

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId");
    const spaceId = request.nextUrl.searchParams.get("spaceId");

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    await connectDB();

    // Fetch all quizzes belonging to the user
    const userQuizzes = await QuizModel.find(
      spaceId ? { spaceId, userId } : { userId },
    ).lean();

    // Also fetch quizzes from other spaces where this user has attempts embedded
    const otherQuizzesWithAttempts = await QuizModel.find({
      "attempts.userId": userId,
    }).lean();

    // Merge into a deduplicated map
    const quizMap = new Map<string, any>();
    [...userQuizzes, ...otherQuizzesWithAttempts].forEach((q) =>
      quizMap.set(q._id.toString(), q),
    );

    // Build a flat, sorted list of this user's quiz attempts from embedded arrays.
    // Scores are stored as 0-100 percentages by the attempt handler.
    const quizAttempts = [...quizMap.values()]
      .flatMap((quiz) =>
        (quiz.attempts || [])
          .filter((a: any) => {
            const aid = a.userId?.toString() ?? "";
            return aid === userId;
          })
          .map((a: any) => ({
            quizId: quiz._id,
            quizTitle: quiz.title as string,
            difficulty: (quiz.difficulty as string) || "medium",
            topic: quiz.topic as string | undefined,
            score: Number(a.score ?? 0), // already 0-100 percentage
            totalQuestions: (quiz.questions?.length as number) || 0,
            completedAt: a.completedAt || a.startedAt || new Date(),
            createdAt: a.startedAt || new Date(),
          })),
      )
      .sort(
        (a, b) =>
          new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
      );

    // Calculate study streak from user_activity (covers quiz + flashcard + any recorded day)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activityRecords = await UserActivityModel.find({ userId }).lean();

    const activityDateSet = new Set(
      activityRecords.map((a) => a.date as string),
    );

    // Also fold in quiz attempt dates so streak counts even without explicit activity records
    quizAttempts.forEach((a) => {
      const d = new Date(a.completedAt || a.createdAt);
      activityDateSet.add(format(d, "yyyy-MM-dd"));
    });

    let studyStreak = 0;
    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const dateStr = format(checkDate, "yyyy-MM-dd");
      if (activityDateSet.has(dateStr)) {
        studyStreak++;
      } else if (i > 0) {
        break;
      }
    }

    // Calculate quiz performance metrics
    // score is already 0-100, so average directly
    const totalAttempts = quizAttempts.length;
    const avgScore =
      totalAttempts > 0
        ? Math.round(
            quizAttempts.reduce((acc, a) => acc + (a.score || 0), 0) /
              totalAttempts,
          )
        : 0;

    // Get weekly progress from quiz attempts
    const weeklyProgress: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(today);
      dayStart.setDate(dayStart.getDate() - i);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const dayAttempts = quizAttempts.filter((a) => {
        const attemptDate = new Date(a.completedAt);
        return attemptDate >= dayStart && attemptDate < dayEnd;
      });

      const dayAvg =
        dayAttempts.length > 0
          ? Math.round(
              dayAttempts.reduce((acc, a) => acc + (a.score || 0), 0) /
                dayAttempts.length,
            )
          : 0;

      weeklyProgress.push(dayAvg);
    }

    // Topic performance — use quiz.topic if set, otherwise quiz title
    const topicScores: Record<string, { total: number; count: number }> = {};

    quizAttempts.forEach((attempt) => {
      const subject = attempt.topic || attempt.quizTitle || "General";
      if (!topicScores[subject]) {
        topicScores[subject] = { total: 0, count: 0 };
      }
      topicScores[subject].total += attempt.score || 0;
      topicScores[subject].count += 1;
    });

    // Calculate average scores by topic
    const topicAvgScores: Record<string, number> = {};
    Object.entries(topicScores).forEach(([topic, data]) => {
      topicAvgScores[topic] = Math.round(data.total / data.count);
    });

    // Identify strong and weak topics
    const sortedTopics = Object.entries(topicAvgScores).sort(
      (a, b) => b[1] - a[1],
    );
    const strongTopics = sortedTopics
      .filter(([, score]) => score >= 70)
      .slice(0, 5)
      .map(([topic]) => topic);
    const weakTopics = sortedTopics
      .filter(([, score]) => score < 70)
      .slice(-5)
      .map(([topic]) => topic);

    // Get flashcard stats
    const flashcards = await FlashcardModel.find(
      spaceId ? { spaceId } : { userId },
    ).lean();

    const flashcardStats = {
      total: flashcards.length,
      // Mastered: reviewed at least once with ≥70% success rate
      mastered: flashcards.filter((f: any) => {
        const total = f.reviewStats?.totalReviews || 0;
        const correct = f.reviewStats?.correctCount || 0;
        return total >= 1 && correct / total >= 0.7;
      }).length,
      // Learning: reviewed at least once but not yet mastered
      learning: flashcards.filter((f: any) => {
        const total = f.reviewStats?.totalReviews || 0;
        const correct = f.reviewStats?.correctCount || 0;
        return total >= 1 && correct / total < 0.7;
      }).length,
      due: flashcards.filter((f: any) => {
        const nextReview = f.reviewStats?.nextReviewAt;
        return !nextReview || new Date(nextReview) <= new Date();
      }).length,
    };

    // Quiz stats by difficulty
    const quizStatsByDifficulty: Record<
      string,
      { attempts: number; avgScore: number }
    > = {};
    quizAttempts.forEach((attempt) => {
      const difficulty = attempt.difficulty || "medium";

      if (!quizStatsByDifficulty[difficulty]) {
        quizStatsByDifficulty[difficulty] = { attempts: 0, avgScore: 0 };
      }

      // score is already 0-100
      quizStatsByDifficulty[difficulty].avgScore =
        (quizStatsByDifficulty[difficulty].avgScore *
          quizStatsByDifficulty[difficulty].attempts +
          (attempt.score || 0)) /
        (quizStatsByDifficulty[difficulty].attempts + 1);
      quizStatsByDifficulty[difficulty].attempts += 1;
    });

    // Recent quiz attempts — score is already percentage
    const recentAttempts = quizAttempts.slice(0, 10).map((a) => ({
      quizTitle: a.quizTitle || "Unknown Quiz",
      score: Math.round((a.score / 100) * a.totalQuestions), // raw count for display
      totalQuestions: a.totalQuestions,
      percentage: a.score, // already 0-100
      completedAt: a.completedAt,
      difficulty: a.difficulty,
    }));

    // Topics mastered: distinct quizzes with ≥70% + mastered flashcards
    const masteredQuizIds = new Set<string>();
    quizAttempts.forEach((a) => {
      if ((a.score || 0) >= 70) masteredQuizIds.add(a.quizId.toString());
    });

    // Generate metrics response
    const metrics = {
      currentStreak: studyStreak,
      totalStudyMinutes: totalAttempts * 10, // Estimate 10 mins per quiz
      quizPerformance: {
        averageScore: avgScore,
        totalAttempts,
        topicScores: topicAvgScores,
        byDifficulty: quizStatsByDifficulty,
      },
      examReadinessScore: Math.min(
        100,
        Math.round(
          avgScore * 0.6 + studyStreak * 2 + flashcardStats.mastered * 2,
        ),
      ),
      strongTopics,
      weakTopics,
      flashcardStats: {
        totalReviewed: flashcardStats.total,
        masteredCards: flashcardStats.mastered,
        masteryRate:
          flashcardStats.total > 0
            ? Math.round((flashcardStats.mastered / flashcardStats.total) * 100)
            : 0,
      },
      projectedExamPerformance: {
        percentile: Math.min(99, Math.round(avgScore * 0.8 + studyStreak)),
        recommendedFocusAreas: weakTopics.slice(0, 3),
      },
    };

    // Get user activity history (same heatmap data as the dashboard)
    const activityHistory = await getUserActivity(userId);

    // Get study timer data for the past year from daily_study_stats
    const dailyStats = await DailyStudyStatsModel.find({ userId })
      .sort({ date: -1 })
      .limit(365)
      .lean();

    const studyTimeActivity = dailyStats.map((t: any) => ({
      date: t.date as string,
      minutes: Math.round((t.totalDuration || 0) / 60),
    }));

    // Compute real total study hours from DailyStudyStats (seconds → hours)
    const totalStudySeconds = dailyStats.reduce(
      (sum: number, t: any) => sum + (t.totalDuration || 0),
      0,
    );
    const totalStudyHoursReal = Math.round(totalStudySeconds / 3600);

    // Generate trend data from quiz attempts
    const trend = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(today);
      dayStart.setDate(dayStart.getDate() - i);

      trend.push({
        date: dayStart.toISOString(),
        score: weeklyProgress[6 - i] || 0,
      });
    }

    return NextResponse.json({
      metrics,
      trend,
      recentAttempts,
      studyStreak,
      totalStudyHours: totalStudyHoursReal,
      topicsMastered: masteredQuizIds.size + flashcardStats.mastered,
      weeklyProgress,
      subjectBreakdown: Object.entries(topicAvgScores).map(
        ([topic, score], i) => ({
          subject: topic,
          percentage: score,
          color: [
            "#6366f1",
            "#8b5cf6",
            "#ec4899",
            "#f97316",
            "#22c55e",
            "#06b6d4",
          ][i % 6],
        }),
      ),
      recentActivity: recentAttempts.map((a: any) => ({
        date: new Date(a.completedAt).toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        }),
        minutes: 10,
        score: a.percentage,
      })),
      flashcardStats,
      quizStats: {
        total: userQuizzes.length,
        completed: totalAttempts,
        avgScore,
      },
      activity: activityHistory,
      studyTimeActivity,
    });
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const {
      userId,
      spaceId,
      durationMinutes,
      topicsReviewed,
      flashcardsReviewed,
    } = await request.json();

    if (!userId || durationMinutes === undefined) {
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
      date: new Date().toISOString().split("T")[0],
    } as any);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error recording study session:", error);
    return NextResponse.json(
      { error: "Failed to record study session" },
      { status: 500 },
    );
  }
}
