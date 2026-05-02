import { type NextRequest, NextResponse } from "next/server";
import { generateFlashcardsForSpace } from "@/lib/services/study-generation";

// POST - Generate flashcards using AI from space content
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { spaceId, userId, numCards = 10, difficulty = "medium" } = body;

    if (!spaceId || !userId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      await generateFlashcardsForSpace({
        spaceId,
        userId,
        numCards,
        difficulty,
      }),
    );
  } catch (error) {
    console.error("Error generating flashcards:", error);
    if (
      error instanceof Error &&
      /No content in this space/i.test(error.message)
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to generate flashcards" },
      { status: 500 },
    );
  }
}
