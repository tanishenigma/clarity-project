import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: Date;
}

export interface IChatHistory extends Document {
  _id: Types.ObjectId;
  conversationId: Types.ObjectId;
  spaceId?: Types.ObjectId;
  messages: IChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const ChatHistorySchema = new Schema<IChatHistory>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    spaceId: { type: Schema.Types.ObjectId, ref: "Space" },
    messages: [
      {
        role: { type: String, enum: ["user", "assistant"], required: true },
        content: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
    collection: "chat_history",
  },
);

ChatHistorySchema.index({ conversationId: 1 });
ChatHistorySchema.index({ spaceId: 1 });

const ChatHistoryModel: Model<IChatHistory> =
  (mongoose.models.ChatHistory as Model<IChatHistory>) ||
  mongoose.model<IChatHistory>("ChatHistory", ChatHistorySchema);

export default ChatHistoryModel;
