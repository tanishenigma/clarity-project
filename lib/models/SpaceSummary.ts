import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface QuickReferenceSection {
  keyTerms: string;
  fundamentalTheories: string;
  essentialFormulas: string;
  keyExamples: string;
  keyApplications: string;
  factsToMemorize: string;
  referenceInfo: string;
  conceptComparisons: string;
}

export interface ISpaceSummary extends Document {
  _id: Types.ObjectId;
  spaceId: Types.ObjectId;
  userId: string;
  outline: string; // HTML
  quickReference: QuickReferenceSection;
  generatedAt: Date;
  updatedAt: Date;
}

const QuickRefSchema = new Schema(
  {
    keyTerms: { type: String, default: "" },
    fundamentalTheories: { type: String, default: "" },
    essentialFormulas: { type: String, default: "" },
    keyExamples: { type: String, default: "" },
    keyApplications: { type: String, default: "" },
    factsToMemorize: { type: String, default: "" },
    referenceInfo: { type: String, default: "" },
    conceptComparisons: { type: String, default: "" },
  },
  { _id: false },
);

const SpaceSummarySchema = new Schema<ISpaceSummary>(
  {
    spaceId: {
      type: Schema.Types.ObjectId,
      ref: "Space",
      required: true,
      index: true,
    },
    userId: { type: String, required: true },
    outline: { type: String, default: "" },
    quickReference: { type: QuickRefSchema, default: () => ({}) },
    generatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: "space_summaries" },
);

SpaceSummarySchema.index({ spaceId: 1, userId: 1 }, { unique: true });

const SpaceSummaryModel: Model<ISpaceSummary> =
  (mongoose.models.SpaceSummary as Model<ISpaceSummary>) ||
  mongoose.model<ISpaceSummary>("SpaceSummary", SpaceSummarySchema);

export default SpaceSummaryModel;
