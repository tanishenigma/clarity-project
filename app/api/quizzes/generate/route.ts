import { type NextRequest, NextResponse } from "next/server";
import { generateQuizForSpace } from "@/lib/services/study-generation";

// POST - Generate a quiz using AI from space content
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { spaceId, userId, difficulty = "medium", numQuestions = 10 } = body;

    if (!spaceId || !userId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      await generateQuizForSpace({
        spaceId,
        userId,
        difficulty,
        numQuestions,
      }),
    );
  } catch (error) {
    console.error("Error generating quiz:", error);
    if (
      error instanceof Error &&
      /No content in this space/i.test(error.message)
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to generate quiz" },
      { status: 500 },
    );
  }
}
