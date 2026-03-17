import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface ILearningSpace extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId | string;
  topic: string;
  pdfSource?: string | null;
  summaryNotes?: any;
  quiz?: any;
  recommendations?: any;
  mindmap?: any;
  audioScript?: string;
  audioOverview?: string;
  status: "pending" | "processing" | "completed" | "failed";
  createdAt: Date;
  updatedAt: Date;
}

const LearningSpaceSchema = new Schema<ILearningSpace>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    topic: { type: String, required: true },
    pdfSource: { type: String, default: null },
    summaryNotes: { type: Schema.Types.Mixed },
    quiz: { type: Schema.Types.Mixed },
    recommendations: { type: Schema.Types.Mixed },
    mindmap: { type: Schema.Types.Mixed },
    audioScript: String,
    audioOverview: String,
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },
  },
  {
    timestamps: true,
    collection: "learning_space",
  },
);

LearningSpaceSchema.index({ userId: 1 });

const LearningSpaceModel: Model<ILearningSpace> =
  (mongoose.models.LearningSpace as Model<ILearningSpace>) ||
  mongoose.model<ILearningSpace>("LearningSpace", LearningSpaceSchema);

export default LearningSpaceModel;
