import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IStudyProgress extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  spaceId: Types.ObjectId;
  date: Date;
  studyMinutes: number;
  topicsReviewed: string[];
  flashcardsReviewed: number;
  weakTopics: string[];
  readinessScore: number;
}

const StudyProgressSchema = new Schema<IStudyProgress>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    spaceId: { type: Schema.Types.ObjectId, ref: "Space", required: true },
    date: { type: Date, required: true },
    studyMinutes: { type: Number, default: 0 },
    topicsReviewed: [String],
    flashcardsReviewed: { type: Number, default: 0 },
    weakTopics: [String],
    readinessScore: { type: Number, default: 0 },
  },
  {
    collection: "study_progress",
  },
);

StudyProgressSchema.index({ userId: 1, spaceId: 1, date: 1 });

const StudyProgressModel: Model<IStudyProgress> =
  (mongoose.models.StudyProgress as Model<IStudyProgress>) ||
  mongoose.model<IStudyProgress>("StudyProgress", StudyProgressSchema);

export default StudyProgressModel;
