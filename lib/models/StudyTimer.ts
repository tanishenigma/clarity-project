import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IStudyTimer extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  dateKey: string; // "yyyy-MM-dd"
  totalSeconds: number;
  isActive: boolean;
  lastStarted?: Date;
  lastUpdated?: Date;
  sessionId?: string;
  currentDuration?: number;
  createdAt: Date;
}

const StudyTimerSchema = new Schema<IStudyTimer>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    dateKey: { type: String, required: true },
    totalSeconds: { type: Number, default: 0 },
    isActive: { type: Boolean, default: false },
    lastStarted: Date,
    lastUpdated: Date,
    sessionId: String,
    currentDuration: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
  },
  {
    collection: "study_timers",
  },
);

StudyTimerSchema.index({ userId: 1, dateKey: 1 }, { unique: true });

const StudyTimerModel: Model<IStudyTimer> =
  (mongoose.models.StudyTimer as Model<IStudyTimer>) ||
  mongoose.model<IStudyTimer>("StudyTimer", StudyTimerSchema);

export default StudyTimerModel;
