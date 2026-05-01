import { type NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import FlashcardModel from "@/lib/models/Flashcard";
import SpaceModel from "@/lib/models/Space";
import { recordActivity } from "@/lib/services/activity";

// GET - Fetch flashcards for a space or user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const spaceId = searchParams.get("spaceId");
    const userId = searchParams.get("userId");
    const dueOnly = searchParams.get("dueOnly") === "true";

    await connectDB();

    const query: any = {};
    if (spaceId) query.spaceId = spaceId;
    if (userId) query.userId = userId;
    if (dueOnly) {
      query.$or = [
        { "reviewStats.nextReviewAt": { $lte: new Date() } },
        { "reviewStats.nextReviewAt": null },
        { "reviewStats.nextReviewAt": { $exists: false } },
      ];
    }

    const flashcards = await FlashcardModel.find(query).lean();

    // Get space names for each flashcard
    const spaceIds = [
      ...new Set(flashcards.map((f) => f.spaceId?.toString()).filter(Boolean)),
    ];
    const spaces = await SpaceModel.find({ _id: { $in: spaceIds } }).lean();

    const spaceMap = new Map(spaces.map((s) => [s._id.toString(), s.name]));

    return NextResponse.json(
      flashcards.map((f) => ({
        ...f,
        _id: f._id.toString(),
        spaceId: f.spaceId?.toString(),
        spaceName: spaceMap.get(f.spaceId?.toString()) || "",
        userId: f.userId?.toString(),
        contentId: f.contentId?.toString(),
      })),
    );
  } catch (error) {
    console.error("Error fetching flashcards:", error);
    return NextResponse.json(
      { error: "Failed to fetch flashcards" },
      { status: 500 },
    );
  }
}

// POST - Create flashcards (single or batch)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { spaceId, userId, flashcards, question, answer, tags } = body;

    if (!spaceId || !userId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    await connectDB();

    // Handle single flashcard creation
    if (question && answer) {
      const card = await FlashcardModel.create({
        spaceId,
        userId,
        contentId: null,
        type: "normal",
        question,
        answer,
        tags: tags || [],
        difficulty: 3,
        generatedAt: new Date(),
        reviewStats: {
          totalReviews: 0,
          correctCount: 0,
          lastReviewedAt: null,
          nextReviewAt: new Date(),
        },
      });

      return NextResponse.json({
        inserted: 1,
        ids: [card._id.toString()],
      });
    }

    // Handle batch flashcard creation
    if (!flashcards || !Array.isArray(flashcards)) {
      return NextResponse.json(
        { error: "Missing flashcards array or single flashcard data" },
        { status: 400 },
      );
    }

    const cardsToInsert = flashcards.map((card: any) => ({
      spaceId,
      userId,
      contentId: card.contentId || null,
      type: card.type || "normal",
      question: card.question,
      answer: card.answer,
      tags: card.tags || [],
      difficulty: card.difficulty || 3,
      generatedAt: new Date(),
      reviewStats: {
        totalReviews: 0,
        correctCount: 0,
        lastReviewedAt: null,
        nextReviewAt: new Date(),
      },
    }));

    const inserted = await FlashcardModel.insertMany(cardsToInsert);

    return NextResponse.json({
      inserted: inserted.length,
      ids: inserted.map((c) => c._id.toString()),
    });
  } catch (error) {
    console.error("Error creating flashcards:", error);
    return NextResponse.json(
      { error: "Failed to create flashcards" },
      { status: 500 },
    );
  }
}

// PUT - Update flashcard review stats (for spaced repetition)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { flashcardId, correct, quality } = body;

    if (!flashcardId) {
      return NextResponse.json(
        { error: "Missing flashcard ID" },
        { status: 400 },
      );
    }

    await connectDB();

    const flashcard = await FlashcardModel.findById(flashcardId).lean();

    if (!flashcard) {
      return NextResponse.json(
        { error: "Flashcard not found" },
        { status: 404 },
      );
    }

    // Simple spaced repetition algorithm
    const stats = flashcard.reviewStats || {
      totalReviews: 0,
      correctCount: 0,
    };

    stats.totalReviews += 1;
    if (correct) stats.correctCount += 1;
    stats.lastReviewedAt = new Date();

    // Calculate next review date based on quality (0-5)
    const q = quality || (correct ? 4 : 2);
    let interval = 1; // days

    if (q >= 4) {
      const successRate = stats.correctCount / stats.totalReviews;
      interval = Math.round(1 + successRate * stats.totalReviews * 0.5);
    }

    stats.nextReviewAt = new Date(Date.now() + interval * 24 * 60 * 60 * 1000);

    await FlashcardModel.updateOne(
      { _id: flashcardId },
      { $set: { reviewStats: stats } },
    );

    // Record activity for heatmap
    if (flashcard.userId) {
      try {
        await recordActivity(flashcard.userId.toString(), "flashcard");
      } catch (e) {
        console.error("Failed to record activity", e);
      }
    }

    return NextResponse.json({
      success: true,
      nextReviewAt: stats.nextReviewAt,
    });
  } catch (error) {
    console.error("Error updating flashcard:", error);
    return NextResponse.json(
      { error: "Failed to update flashcard" },
      { status: 500 },
    );
  }
}
// DELETE - Delete a flashcard
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Missing flashcard ID" },
        { status: 400 },
      );
    }

    await connectDB();

    const result = await FlashcardModel.deleteOne({ _id: id });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: "Flashcard not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting flashcard:", error);
    return NextResponse.json(
      { error: "Failed to delete flashcard" },
      { status: 500 },
    );
  }
}
