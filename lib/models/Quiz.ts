import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IQuizQuestion {
  _id?: Types.ObjectId;
  text: string;
  type: "mcq" | "subjective" | "truefalse";
  options?: string[];
  correctAnswer: string | number;
  explanation: string;
  tags: string[];
  order?: number;
  difficulty?: number;
}

export interface IQuizAttempt {
  userId: Types.ObjectId;
  startedAt: Date;
  completedAt?: Date;
  score: number;
  answers: Record<string, string> | (string | number | null)[];
  analytics: {
    timeSpent?: number;
    questionsSkipped?: number;
    correctPerTopic: Record<string, number>;
  };
}

export interface IQuiz extends Document {
  _id: Types.ObjectId;
  contentId: Types.ObjectId | null;
  spaceId: Types.ObjectId;
  userId: Types.ObjectId;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  topic?: string;
  questions: IQuizQuestion[];
  timeLimit?: number;
  attempts: IQuizAttempt[];
  generatedAt: Date;
  isActive: boolean;
  completedAt?: Date;
  lastScore?: number;
  attemptCount?: number;
}

const QuizSchema = new Schema<IQuiz>(
  {
    contentId: { type: Schema.Types.ObjectId, ref: "Content", default: null },
    spaceId: { type: Schema.Types.ObjectId, ref: "Space", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "medium",
    },
    topic: String,
    questions: [
      {
        text: { type: String, required: true },
        type: {
          type: String,
          enum: ["mcq", "subjective", "truefalse"],
          default: "mcq",
        },
        options: [String],
        correctAnswer: Schema.Types.Mixed,
        explanation: { type: String, default: "" },
        tags: [String],
        order: Number,
        difficulty: Number,
      },
    ],
    timeLimit: Number,
    attempts: [
      {
        userId: { type: Schema.Types.ObjectId, ref: "User" },
        startedAt: Date,
        completedAt: Date,
        score: Number,
        answers: Schema.Types.Mixed,
        analytics: {
          timeSpent: Number,
          questionsSkipped: Number,
          correctPerTopic: { type: Map, of: Number, default: {} },
        },
      },
    ],
    generatedAt: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
    completedAt: Date,
    lastScore: Number,
    attemptCount: { type: Number, default: 0 },
  },
  {
    collection: "quizzes",
  },
);

QuizSchema.index({ spaceId: 1, userId: 1 });
QuizSchema.index({ "attempts.userId": 1 });

const QuizModel: Model<IQuiz> =
  (mongoose.models.Quiz as Model<IQuiz>) ||
  mongoose.model<IQuiz>("Quiz", QuizSchema);

export default QuizModel;
