import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IStudyTimerHistory extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  dateKey: string;
  seconds: number;
  timestamp: Date;
}

const StudyTimerHistorySchema = new Schema<IStudyTimerHistory>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    dateKey: { type: String, required: true },
    seconds: { type: Number, required: true },
    timestamp: { type: Date, default: Date.now },
  },
  {
    collection: "study_timer_history",
  },
);

StudyTimerHistorySchema.index({ userId: 1, dateKey: 1 });

const StudyTimerHistoryModel: Model<IStudyTimerHistory> =
  (mongoose.models.StudyTimerHistory as Model<IStudyTimerHistory>) ||
  mongoose.model<IStudyTimerHistory>(
    "StudyTimerHistory",
    StudyTimerHistorySchema,
  );

export default StudyTimerHistoryModel;
