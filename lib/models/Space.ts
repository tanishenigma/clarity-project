import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface ISpace extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  name: string;
  description: string;
  icon: string;
  subject: string;
  examTarget: string;
  coverImage?: string;
  isPublic: boolean;
  collaborators: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const SpaceSchema = new Schema<ISpace>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    subject: { type: String, default: "General" },
    examTarget: { type: String, default: "" },
    coverImage: String,
    isPublic: { type: Boolean, default: false },
    collaborators: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  {
    timestamps: true,
    collection: "spaces",
  },
);

SpaceSchema.index({ userId: 1 });
SpaceSchema.index({ collaborators: 1 });

const SpaceModel: Model<ISpace> =
  (mongoose.models.Space as Model<ISpace>) ||
  mongoose.model<ISpace>("Space", SpaceSchema);

export default SpaceModel;
