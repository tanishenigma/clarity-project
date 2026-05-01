import { type NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { SpacedRepetitionEngine } from "@/lib/services/spaced-repetition";
import FlashcardModel from "@/lib/models/Flashcard";
import { recordActivity } from "@/lib/services/activity";

// Get flashcards for review
export async function GET(request: NextRequest) {
  try {
    const spaceId = request.nextUrl.searchParams.get("spaceId");
    const userId = request.nextUrl.searchParams.get("userId");
    const limit = request.nextUrl.searchParams.get("limit");

    if (!spaceId || !userId) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 },
      );
    }

    const engine = new SpacedRepetitionEngine();
    const cards = await engine.getCardsForReview(
      spaceId,
      userId,
      limit ? Number.parseInt(limit) : 20,
    );
    const stats = await engine.getReviewStats(spaceId, userId);

    return NextResponse.json({
      cards: cards.map((c) => ({
        _id: c._id,
        question: c.question,
        type: c.type,
        difficulty: c.difficulty,
      })),
      stats,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 },
    );
  }
}

// Update flashcard review
export async function POST(request: NextRequest) {
  try {
    const { cardId, quality } = await request.json();

    if (!cardId || quality === undefined) {
      return NextResponse.json(
        { error: "Missing cardId or quality" },
        { status: 400 },
      );
    }

    if (quality < 0 || quality > 5) {
      return NextResponse.json(
        { error: "Quality must be 0-5" },
        { status: 400 },
      );
    }

    const engine = new SpacedRepetitionEngine();
    await engine.updateCardReview(cardId, quality);

    await connectDB();
    const updated = await FlashcardModel.findById(cardId).lean();

    if (updated && updated.userId) {
      // Record activity for heatmap
      await recordActivity(updated.userId.toString(), "flashcard");
    }

    return NextResponse.json({
      success: true,
      nextReviewAt: updated?.reviewStats.nextReviewAt,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 },
    );
  }
}
