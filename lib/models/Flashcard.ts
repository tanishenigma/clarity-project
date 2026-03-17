import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IFlashcard extends Document {
  _id: Types.ObjectId;
  contentId: Types.ObjectId | null;
  spaceId: Types.ObjectId;
  userId: Types.ObjectId;
  type: "normal" | "activeRecall";
  question: string;
  answer: string;
  tags: string[];
  difficulty: number;
  generatedAt: Date;
  reviewStats: {
    totalReviews: number;
    correctCount: number;
    lastReviewedAt?: Date | null;
    nextReviewAt?: Date | null;
  };
}

const FlashcardSchema = new Schema<IFlashcard>(
  {
    contentId: { type: Schema.Types.ObjectId, ref: "Content", default: null },
    spaceId: { type: Schema.Types.ObjectId, ref: "Space", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["normal", "activeRecall"], default: "normal" },
    question: { type: String, required: true },
    answer: { type: String, required: true },
    tags: [String],
    difficulty: { type: Number, default: 3 },
    generatedAt: { type: Date, default: Date.now },
    reviewStats: {
      totalReviews: { type: Number, default: 0 },
      correctCount: { type: Number, default: 0 },
      lastReviewedAt: { type: Date, default: null },
      nextReviewAt: { type: Date, default: null },
    },
  },
  {
    collection: "flashcards",
  },
);

FlashcardSchema.index({ spaceId: 1, userId: 1 });
FlashcardSchema.index({ userId: 1, "reviewStats.nextReviewAt": 1 });

const FlashcardModel: Model<IFlashcard> =
  (mongoose.models.Flashcard as Model<IFlashcard>) ||
  mongoose.model<IFlashcard>("Flashcard", FlashcardSchema);

export default FlashcardModel;
