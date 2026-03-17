import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IUserActivity extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  date: string; // "yyyy-MM-dd"
  count: number;
  lastUpdated: Date;
  createdAt: Date;
}

const UserActivitySchema = new Schema<IUserActivity>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: String, required: true },
    count: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now },
  },
  {
    collection: "user_activity",
  },
);

UserActivitySchema.index({ userId: 1, date: 1 }, { unique: true });

const UserActivityModel: Model<IUserActivity> =
  (mongoose.models.UserActivity as Model<IUserActivity>) ||
  mongoose.model<IUserActivity>("UserActivity", UserActivitySchema);

export default UserActivityModel;
