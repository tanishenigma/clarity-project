import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface ISpaceInvite extends Document {
  _id: Types.ObjectId;
  spaceId: Types.ObjectId;
  invitedEmail: string;
  invitedBy: Types.ObjectId;
  role: "viewer" | "contributor" | "admin";
  status: "pending" | "accepted" | "rejected";
  createdAt: Date;
  expiresAt: Date;
}

const SpaceInviteSchema = new Schema<ISpaceInvite>(
  {
    spaceId: { type: Schema.Types.ObjectId, ref: "Space", required: true },
    invitedEmail: { type: String, required: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: {
      type: String,
      enum: ["viewer", "contributor", "admin"],
      default: "viewer",
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
  },
  {
    collection: "space_invites",
  },
);

const SpaceInviteModel: Model<ISpaceInvite> =
  (mongoose.models.SpaceInvite as Model<ISpaceInvite>) ||
  mongoose.model<ISpaceInvite>("SpaceInvite", SpaceInviteSchema);

export default SpaceInviteModel;
