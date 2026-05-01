import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IStudySession extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  startTime: Date;
  endTime?: Date;
  duration: number;
  isActive: boolean;
  date: string; // "yyyy-MM-dd" study day
  currentDuration?: number;
  type?: string;
  durationMinutes?: number;
  startedAt?: Date;
  spaceId?: Types.ObjectId | null;
  activity?: string;
  createdAt: Date;
  updatedAt: Date;
}

const StudySessionSchema = new Schema<IStudySession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    startTime: { type: Date, default: Date.now },
    endTime: Date,
    duration: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    date: { type: String },
    currentDuration: { type: Number, default: 0 },
    type: String,
    durationMinutes: { type: Number, default: 0 },
    startedAt: Date,
    spaceId: { type: Schema.Types.ObjectId, ref: "Space", default: null },
    activity: String,
  },
  {
    timestamps: true,
    collection: "study_sessions",
  },
);

StudySessionSchema.index({ userId: 1, isActive: 1 });
StudySessionSchema.index({ userId: 1, date: 1 });

const StudySessionModel: Model<IStudySession> =
  (mongoose.models.StudySession as Model<IStudySession>) ||
  mongoose.model<IStudySession>("StudySession", StudySessionSchema);

export default StudySessionModel;
