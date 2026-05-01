import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface ISession extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  createdAt: Date;
  expiresAt: Date;
}

const SessionSchema = new Schema<ISession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
  },
  { collection: "sessions" },
);

SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const SessionModel: Model<ISession> =
  (mongoose.models.Session as Model<ISession>) ||
  mongoose.model<ISession>("Session", SessionSchema);

export default SessionModel;
