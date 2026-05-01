import { type NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import QuizModel from "@/lib/models/Quiz";

// GET - Fetch quizzes for a space or user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const spaceId = searchParams.get("spaceId");
    const userId = searchParams.get("userId");

    await connectDB();

    const query: any = {};
    if (spaceId) query.spaceId = spaceId;
    if (userId) query.userId = userId;

    const quizzes = await QuizModel.find(query).lean();

    return NextResponse.json({
      quizzes: quizzes.map((q) => ({
        ...q,
        _id: q._id.toString(),
        spaceId: q.spaceId?.toString(),
        userId: q.userId?.toString(),
        contentId: q.contentId?.toString(),
      })),
    });
  } catch (error) {
    console.error("Error fetching quizzes:", error);
    return NextResponse.json(
      { error: "Failed to fetch quizzes" },
      { status: 500 },
    );
  }
}

// POST - Create a quiz
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { spaceId, userId, title, difficulty, questions, contentId } = body;

    if (!spaceId || !userId || !title || !questions) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    await connectDB();

    const quiz = await QuizModel.create({
      spaceId,
      userId,
      contentId: contentId || null,
      title,
      difficulty: difficulty || "medium",
      questions: questions.map((q: any, index: number) => ({
        text: q.text,
        type: q.type || "mcq",
        options: q.options || [],
        correctAnswer: q.correctAnswer,
        explanation: q.explanation || "",
        tags: q.tags || [],
        order: index,
      })),
      attempts: [],
      generatedAt: new Date(),
      isActive: true,
    });

    return NextResponse.json({
      quiz: {
        ...quiz.toObject(),
        _id: quiz._id.toString(),
        spaceId: spaceId,
        userId: userId,
      },
    });
  } catch (error) {
    console.error("Error creating quiz:", error);
    return NextResponse.json(
      { error: "Failed to create quiz" },
      { status: 500 },
    );
  }
}
