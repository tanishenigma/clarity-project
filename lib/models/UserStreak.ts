import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IUserStreak extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string; // "yyyy-MM-dd"
  createdAt: Date;
  updatedAt: Date;
}

const UserStreakSchema = new Schema<IUserStreak>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    currentStreak: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
    lastActivityDate: { type: String, default: "" },
  },
  {
    timestamps: true,
    collection: "user_streaks",
  },
);

const UserStreakModel: Model<IUserStreak> =
  (mongoose.models.UserStreak as Model<IUserStreak>) ||
  mongoose.model<IUserStreak>("UserStreak", UserStreakSchema);

export default UserStreakModel;
