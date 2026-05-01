import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface ISummary extends Document {
  _id: Types.ObjectId;
  contentId: Types.ObjectId;
  spaceId: Types.ObjectId;
  type: "quick" | "detailed" | "examFocused";
  title: string;
  chapterBreakdown: Array<{
    chapter: number;
    title: string;
    keyPoints: string[];
    summary: string;
    keyTerms: Record<string, string>;
  }>;
  generatedAt: Date;
}

const SummarySchema = new Schema<ISummary>(
  {
    contentId: { type: Schema.Types.ObjectId, ref: "Content", required: true },
    spaceId: { type: Schema.Types.ObjectId, ref: "Space", required: true },
    type: {
      type: String,
      enum: ["quick", "detailed", "examFocused"],
      required: true,
    },
    title: { type: String, required: true },
    chapterBreakdown: [
      {
        chapter: Number,
        title: String,
        keyPoints: [String],
        summary: String,
        keyTerms: { type: Map, of: String },
      },
    ],
    generatedAt: { type: Date, default: Date.now },
  },
  {
    collection: "summaries",
  },
);

SummarySchema.index({ contentId: 1 });
SummarySchema.index({ spaceId: 1 });

const SummaryModel: Model<ISummary> =
  (mongoose.models.Summary as Model<ISummary>) ||
  mongoose.model<ISummary>("Summary", SummarySchema);

export default SummaryModel;
