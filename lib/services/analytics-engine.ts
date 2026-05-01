import { connectDB } from "@/lib/db";
import { Types } from "mongoose";
import QuizModel from "@/lib/models/Quiz";
import FlashcardModel from "@/lib/models/Flashcard";
import StudyProgressModel from "@/lib/models/StudyProgress";
import UserModel from "@/lib/models/User";

export interface AnalyticsMetrics {
  totalStudyMinutes: number;
  currentStreak: number;
  totalSessions: number;
  quizPerformance: {
    averageScore: number;
    totalAttempts: number;
    topicScores: Record<string, number>;
  };
  flashcardStats: {
    totalReviewed: number;
    masteredCards: number;
    masteryRate: number;
  };
  weakTopics: string[];
  strongTopics: string[];
  examReadinessScore: number;
  projectedExamPerformance: {
    percentile: number;
    recommendedFocusAreas: string[];
  };
}

export class AnalyticsEngine {
  /**
   * Get comprehensive analytics for a user in a space
   */
  async getAnalytics(
    spaceId: string,
    userId: string,
  ): Promise<AnalyticsMetrics> {
    await connectDB();

    // Fetch all relevant data
    const [quizzes, flashcards, progress] = await Promise.all([
      QuizModel.find({
        spaceId: new Types.ObjectId(spaceId),
        userId: new Types.ObjectId(userId),
      }).lean(),
      FlashcardModel.find({
        spaceId: new Types.ObjectId(spaceId),
        userId: new Types.ObjectId(userId),
      }).lean(),
      StudyProgressModel.find({
        spaceId: new Types.ObjectId(spaceId),
        userId: new Types.ObjectId(userId),
      }).lean(),
    ]);

    // Calculate quiz performance
    const quizPerformance = this.calculateQuizPerformance(quizzes);

    // Calculate flashcard stats
    const flashcardStats = this.calculateFlashcardStats(flashcards);

    // Calculate study streaks
    const { currentStreak, totalStudyMinutes, totalSessions } =
      this.calculateStreakAndTime(progress);

    // Identify weak and strong topics
    const { weakTopics, strongTopics } = this.identifyTopics(
      quizPerformance,
      flashcardStats,
    );

    // Calculate exam readiness
    const examReadinessScore = this.calculateExamReadiness(
      quizPerformance,
      flashcardStats,
      currentStreak,
    );

    // Project exam performance
    const projectedExamPerformance = this.projectExamPerformance(
      examReadinessScore,
      quizPerformance,
      weakTopics,
      strongTopics,
    );

    return {
      totalStudyMinutes,
      currentStreak,
      totalSessions,
      quizPerformance,
      flashcardStats,
      weakTopics,
      strongTopics,
      examReadinessScore,
      projectedExamPerformance,
    };
  }

  /**
   * Record study session
   */
  async recordStudySession(
    userId: string,
    spaceId: string,
    durationMinutes: number,
    topicsReviewed: string[],
    flashcardsReviewed: number,
  ): Promise<void> {
    await connectDB();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if today's session exists
    const existing = await StudyProgressModel.findOne({
      userId: new Types.ObjectId(userId),
      spaceId: new Types.ObjectId(spaceId),
      date: today,
    }).lean();

    if (existing) {
      // Update existing session
      await StudyProgressModel.updateOne(
        { _id: existing._id },
        {
          $set: {
            studyMinutes: existing.studyMinutes + durationMinutes,
            topicsReviewed: Array.from(
              new Set([...existing.topicsReviewed, ...topicsReviewed]),
            ),
            flashcardsReviewed:
              existing.flashcardsReviewed + flashcardsReviewed,
          },
        },
      );
    } else {
      // Create new session
      await StudyProgressModel.create({
        userId: new Types.ObjectId(userId),
        spaceId: new Types.ObjectId(spaceId),
        date: today,
        studyMinutes: durationMinutes,
        topicsReviewed,
        flashcardsReviewed,
        weakTopics: [],
        readinessScore: 0,
      });
    }

    // Update user streak
    await this.updateStreak(userId);
  }

  /**
   * Calculate quiz performance metrics
   */
  private calculateQuizPerformance(quizzes: any[]): {
    averageScore: number;
    totalAttempts: number;
    topicScores: Record<string, number>;
  } {
    const topicScores: Record<string, number> = {};
    let totalScore = 0;
    let totalAttempts = 0;

    for (const quiz of quizzes) {
      if (quiz.attempts && quiz.attempts.length > 0) {
        const avgAttemptScore =
          quiz.attempts.reduce((sum: number, a: any) => sum + a.score, 0) /
          quiz.attempts.length;

        for (const question of quiz.questions) {
          for (const tag of question.tags) {
            topicScores[tag] = topicScores[tag]
              ? (topicScores[tag] + avgAttemptScore) / 2
              : avgAttemptScore;
          }
        }

        totalScore += avgAttemptScore;
        totalAttempts += quiz.attempts.length;
      }
    }

    return {
      averageScore:
        totalAttempts > 0 ? Math.round(totalScore / quizzes.length) : 0,
      totalAttempts,
      topicScores,
    };
  }

  /**
   * Calculate flashcard mastery stats
   */
  private calculateFlashcardStats(flashcards: any[]): {
    totalReviewed: number;
    masteredCards: number;
    masteryRate: number;
  } {
    let totalReviewed = 0;
    let masteredCards = 0;

    for (const card of flashcards) {
      const totalReviews = card.reviewStats.totalReviews;
      const correctCount = card.reviewStats.correctCount;

      if (totalReviews > 0) {
        totalReviewed++;

        const correctRate = correctCount / totalReviews;
        if (correctRate >= 0.7) {
          masteredCards++;
        }
      }
    }

    return {
      totalReviewed,
      masteredCards,
      masteryRate:
        totalReviewed > 0
          ? Math.round((masteredCards / totalReviewed) * 100)
          : 0,
    };
  }

  /**
   * Calculate study streak and time
   */
  private calculateStreakAndTime(progress: any[]): {
    currentStreak: number;
    totalStudyMinutes: number;
    totalSessions: number;
  } {
    if (progress.length === 0) {
      return { currentStreak: 0, totalStudyMinutes: 0, totalSessions: 0 };
    }

    // Sort by date
    const sorted = progress.sort(
      (a: any, b: any) =>
        new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    let currentStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < sorted.length; i++) {
      const sessionDate = new Date(sorted[i].date);
      sessionDate.setHours(0, 0, 0, 0);

      const expectedDate = new Date(today);
      expectedDate.setDate(expectedDate.getDate() - i);

      if (sessionDate.getTime() === expectedDate.getTime()) {
        currentStreak++;
      } else {
        break;
      }
    }

    const totalStudyMinutes = progress.reduce(
      (sum: number, p: any) => sum + p.studyMinutes,
      0,
    );

    return {
      currentStreak,
      totalStudyMinutes,
      totalSessions: progress.length,
    };
  }

  /**
   * Identify weak and strong topics
   */
  private identifyTopics(
    quizPerformance: { topicScores: Record<string, number> },
    flashcardStats: { masteryRate: number },
  ): { weakTopics: string[]; strongTopics: string[] } {
    const topicEntries = Object.entries(quizPerformance.topicScores).sort(
      ([, a], [, b]) => a - b,
    );

    const weakTopics = topicEntries.slice(0, 3).map(([topic]) => topic);
    const strongTopics = topicEntries
      .slice(-3)
      .reverse()
      .map(([topic]) => topic);

    return { weakTopics, strongTopics };
  }

  /**
   * Calculate exam readiness score (0-100)
   */
  private calculateExamReadiness(
    quizPerformance: { averageScore: number },
    flashcardStats: { masteryRate: number },
    currentStreak: number,
  ): number {
    const quizWeight = quizPerformance.averageScore * 0.4;
    const flashcardWeight = flashcardStats.masteryRate * 0.35;
    const streakWeight = Math.min(currentStreak, 30) * 0.25;

    return Math.round(quizWeight + flashcardWeight + streakWeight);
  }

  /**
   * Project exam performance
   */
  private projectExamPerformance(
    readinessScore: number,
    quizPerformance: { averageScore: number },
    weakTopics: string[],
    strongTopics: string[],
  ): { percentile: number; recommendedFocusAreas: string[] } {
    // Convert readiness to percentile
    const percentile = Math.round(readinessScore * 0.9);

    const recommendedFocusAreas =
      weakTopics.length > 0 ? weakTopics : ["General review"];

    return {
      percentile,
      recommendedFocusAreas,
    };
  }

  /**
   * Update user study streak
   */
  private async updateStreak(userId: string): Promise<void> {
    await connectDB();

    const analytics = await StudyProgressModel.find({
      userId: new Types.ObjectId(userId),
    })
      .sort({ date: -1 })
      .lean();

    if (analytics.length === 0) return;

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < analytics.length; i++) {
      const sessionDate = new Date(analytics[i].date);
      sessionDate.setHours(0, 0, 0, 0);

      const expectedDate = new Date(today);
      expectedDate.setDate(expectedDate.getDate() - i);

      if (sessionDate.getTime() === expectedDate.getTime()) {
        streak++;
      } else {
        break;
      }
    }

    await UserModel.updateOne(
      { _id: new Types.ObjectId(userId) },
      { $set: { studyStreak: streak } },
    );
  }

  /**
   * Get performance summary for last N days
   */
  async getPerformanceTrend(
    spaceId: string,
    userId: string,
    days = 7,
  ): Promise<Array<{ date: Date; score: number }>> {
    await connectDB();

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const trend = await StudyProgressModel.find({
      spaceId: new Types.ObjectId(spaceId),
      userId: new Types.ObjectId(userId),
      date: { $gte: startDate },
    })
      .sort({ date: 1 })
      .lean();

    return trend.map((t: any) => ({
      date: t.date,
      score: Math.round((t.readinessScore + 50) / 2),
    }));
  }
}
