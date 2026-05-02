import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface ICitationRecord {
  idx: number;
  title: string;
  url: string;
  snippet: string;
  contentId?: string;
}

export interface IChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: Date;
  citations?: ICitationRecord[];
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
        citations: [
          {
            idx: Number,
            title: String,
            url: String,
            snippet: String,
            contentId: String,
          },
        ],
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
