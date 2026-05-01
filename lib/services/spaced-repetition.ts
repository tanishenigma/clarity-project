import { connectDB } from "@/lib/db";
import { Types } from "mongoose";
import FlashcardModel from "@/lib/models/Flashcard";
import type { Flashcard } from "@/lib/types";

// Spaced Repetition Algorithm (SM-2)
export class SpacedRepetitionEngine {
  private readonly MIN_INTERVAL = 1; // days
  private readonly MAX_INTERVAL = 365; // days

  /**
   * Get flashcards due for review
   */
  async getCardsForReview(
    spaceId: string,
    userId: string,
    limit = 20,
  ): Promise<Flashcard[]> {
    await connectDB();

    const cards = await FlashcardModel.find({
      spaceId: new Types.ObjectId(spaceId),
      userId: new Types.ObjectId(userId),
      $or: [
        { "reviewStats.nextReviewAt": { $lte: new Date() } },
        { "reviewStats.nextReviewAt": { $exists: false } },
      ],
    })
      .sort({ "reviewStats.nextReviewAt": 1 })
      .limit(limit)
      .lean();

    return cards as unknown as Flashcard[];
  }

  /**
   * Update card after review
   * quality: 0-5 scale (0=incorrect, 5=perfect recall)
   */
  async updateCardReview(cardId: string, quality: number): Promise<void> {
    await connectDB();

    const card = (await FlashcardModel.findById(
      new Types.ObjectId(cardId),
    ).lean()) as unknown as Flashcard | null;

    if (!card) throw new Error("Card not found");

    const stats = card.reviewStats;
    const newReview = {
      totalReviews: stats.totalReviews + 1,
      correctCount: stats.correctCount + (quality >= 3 ? 1 : 0),
      lastReviewedAt: new Date(),
      nextReviewAt: this.calculateNextReview(stats, quality),
    };

    await FlashcardModel.updateOne(
      { _id: new Types.ObjectId(cardId) },
      {
        $set: {
          reviewStats: newReview,
          difficulty: Math.max(
            1,
            Math.min(5, card.difficulty + (quality > 3 ? 1 : -1)),
          ),
        },
      },
    );
  }

  /**
   * Calculate SM-2 interval
   */
  private calculateNextReview(
    stats: { totalReviews: number; correctCount: number; nextReviewAt?: Date },
    quality: number,
  ): Date {
    let interval = this.MIN_INTERVAL;

    if (stats.totalReviews === 0) {
      interval = this.MIN_INTERVAL;
    } else if (stats.totalReviews === 1) {
      interval = 3;
    } else {
      // SM-2 formula: I(n) = I(n-1) * EF
      // where EF (Easiness Factor) = max(1.3, EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)))
      const correctRate = stats.correctCount / stats.totalReviews;
      interval = Math.max(
        this.MIN_INTERVAL,
        Math.round(stats.totalReviews * (2 + correctRate * 3)),
      );
    }

    // Cap interval
    interval = Math.min(interval, this.MAX_INTERVAL);

    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + interval);
    return nextDate;
  }

  /**
   * Get review statistics
   */
  async getReviewStats(spaceId: string, userId: string) {
    await connectDB();

    const cards = await FlashcardModel.find({
      spaceId: new Types.ObjectId(spaceId),
      userId: new Types.ObjectId(userId),
    }).lean();

    const totalCards = cards.length;
    const reviewedCards = cards.filter(
      (c: any) => c.reviewStats.totalReviews > 0,
    ).length;
    const dueCards = cards.filter(
      (c: any) =>
        !c.reviewStats.nextReviewAt || c.reviewStats.nextReviewAt <= new Date(),
    ).length;

    const avgCorrectRate =
      totalCards > 0
        ? (cards.reduce(
            (sum: number, c: any) =>
              sum +
              c.reviewStats.correctCount /
                Math.max(1, c.reviewStats.totalReviews),
            0,
          ) /
            totalCards) *
          100
        : 0;

    return {
      totalCards,
      reviewedCards,
      dueCards,
      masteredCards: cards.filter(
        (c: any) =>
          c.reviewStats.correctCount >= c.reviewStats.totalReviews * 0.8,
      ).length,
      averageCorrectRate: Math.round(avgCorrectRate),
    };
  }
}
