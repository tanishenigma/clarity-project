import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IConversation extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  spaceId: Types.ObjectId;
  title: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema = new Schema<IConversation>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    spaceId: { type: Schema.Types.ObjectId, ref: "Space", required: true },
    title: { type: String, default: "New Conversation" },
    active: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    collection: "conversations",
  },
);

ConversationSchema.index({ userId: 1, spaceId: 1 });

const ConversationModel: Model<IConversation> =
  (mongoose.models.Conversation as Model<IConversation>) ||
  mongoose.model<IConversation>("Conversation", ConversationSchema);

export default ConversationModel;
