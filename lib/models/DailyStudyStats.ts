import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IDailyStudyStats extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  date: string; // "yyyy-MM-dd"
  totalDuration: number; // seconds
  longestSession: number; // seconds
  sessionCount: number;
  resetAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DailyStudyStatsSchema = new Schema<IDailyStudyStats>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: String, required: true },
    totalDuration: { type: Number, default: 0 },
    longestSession: { type: Number, default: 0 },
    sessionCount: { type: Number, default: 0 },
    resetAt: Date,
  },
  {
    timestamps: true,
    collection: "daily_study_stats",
  },
);

DailyStudyStatsSchema.index({ userId: 1, date: 1 }, { unique: true });

const DailyStudyStatsModel: Model<IDailyStudyStats> =
  (mongoose.models.DailyStudyStats as Model<IDailyStudyStats>) ||
  mongoose.model<IDailyStudyStats>("DailyStudyStats", DailyStudyStatsSchema);

export default DailyStudyStatsModel;
