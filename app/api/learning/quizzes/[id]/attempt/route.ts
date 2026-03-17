import { type NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { recordActivity } from "@/lib/services/activity";
import QuizModel from "@/lib/models/Quiz";
import StudySessionModel from "@/lib/models/StudySession";
import UserStreakModel from "@/lib/models/UserStreak";

// Update daily study streak
async function updateStudyStreak(userId: string) {
  await connectDB();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0];

  // Check if there's already a study session today
  const existingSession = await StudySessionModel.findOne({
    userId,
    date: todayStr,
  }).lean();

  if (!existingSession) {
    // Create a new study session for today
    await StudySessionModel.create({
      userId,
      date: todayStr,
      startedAt: new Date(),
      type: "quiz",
      durationMinutes: 5, // Default duration for quiz
    });
  }

  // Track activity for heatmap
  await recordActivity(userId, "quiz");

  // Calculate and update streak
  const streakDoc = await UserStreakModel.findOne({ userId }).lean();

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  let newStreak = 1;
  let longestStreak = 1;

  if (streakDoc) {
    // Check if last activity was yesterday (continue streak) or today (same day)
    if (streakDoc.lastActivityDate === todayStr) {
      // Already counted today, keep current streak
      newStreak = streakDoc.currentStreak;
    } else if (streakDoc.lastActivityDate === yesterdayStr) {
      // Continuing the streak
      newStreak = streakDoc.currentStreak + 1;
    }
    // If neither, streak resets to 1

    longestStreak = Math.max(streakDoc.longestStreak || 1, newStreak);
  }

  // Upsert streak document
  await UserStreakModel.updateOne(
    { userId },
    {
      $set: {
        currentStreak: newStreak,
        longestStreak: longestStreak,
        lastActivityDate: todayStr,
        updatedAt: new Date(),
      },
      $setOnInsert: {
        userId,
        createdAt: new Date(),
      },
    },
    { upsert: true },
  );

  return newStreak;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const {
      userId,
      answers,
      timeSpent,
      score: rawScore,
      totalQuestions: rawTotal,
    } = await request.json();

    // Validate IDs
    if (!userId || userId.length !== 24 || !/^[0-9a-f]{24}$/i.test(userId)) {
      return NextResponse.json(
        { error: "Invalid userId format" },
        { status: 400 },
      );
    }

    if (!id || id.length !== 24 || !/^[0-9a-f]{24}$/i.test(id)) {
      return NextResponse.json(
        { error: "Invalid quiz ID format" },
        { status: 400 },
      );
    }

    await connectDB();
    const quiz = await QuizModel.findById(id).lean();

    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    // Calculate score.
    // The client sends answers as a positional array (answers[questionIndex] = selectedOptionIndex)
    // but this route previously expected answers keyed by question._id, causing score=0 every time.
    // Use the client-provided rawScore/rawTotal when available (accurate); fall back to local calc.
    let correctCount = 0;
    const correctPerTopic: Record<string, number> = {};

    if (rawScore !== undefined && rawTotal) {
      // Client already computed the correct answer count
      correctCount = Number(rawScore);
      // percentage stored as 0-100
    } else {
      // Legacy: try object-keyed answers
      for (const question of quiz.questions) {
        const isCorrect =
          answers[question._id?.toString() ?? ""] === question.correctAnswer;
        if (isCorrect) {
          correctCount++;
          for (const tag of question.tags || []) {
            correctPerTopic[tag] = (correctPerTopic[tag] || 0) + 1;
          }
        }
      }
    }

    const totalQs = rawTotal ?? quiz.questions.length;
    const score = Math.round((correctCount / totalQs) * 100);

    // Store attempt
    const attempt = {
      userId: new Types.ObjectId(userId),
      startedAt: new Date(),
      completedAt: new Date(),
      score,
      answers,
      analytics: {
        timeSpent,
        questionsSkipped: Array.isArray(answers)
          ? answers.filter((a) => a === null || a === undefined).length
          : Object.keys(answers ?? {}).length < quiz.questions.length
            ? 1
            : 0,
        correctPerTopic,
      },
    };

    await QuizModel.updateOne(
      { _id: id },
      {
        $push: { attempts: attempt } as any,
      },
    );

    // Track activity for heatmap
    try {
      await recordActivity(userId, "quiz");
    } catch (e) {
      console.error("Failed to record activity", e);
    }

    // Update study streak
    const currentStreak = await updateStudyStreak(userId);

    return NextResponse.json({
      score,
      correctCount,
      totalQuestions: totalQs,
      performance: {
        excellent: score >= 80,
        good: score >= 60 && score < 80,
        needsWork: score < 60,
      },
      streak: currentStreak,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 },
    );
  }
}

// Get quiz with questions
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await connectDB();
    const quiz = await QuizModel.findById(id).lean();

    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    return NextResponse.json({
      _id: quiz._id,
      title: quiz.title,
      difficulty: quiz.difficulty,
      timeLimit: quiz.timeLimit,
      questions: quiz.questions.map((q: any) => ({
        _id: q._id,
        text: q.text,
        type: q.type,
        options: q.options,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 },
    );
  }
}
