import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IGlobalMessage {
  role: "user" | "assistant" | "system";
  content: string;
  files?: Array<{ name: string; url: string; type: string; publicId: string }>;
  graphUpdate?: any;
  feedbackLog?: string[];
  timestamp?: Date;
}

export interface IGlobalConversation extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  title: string;
  messages: IGlobalMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const GlobalConversationSchema = new Schema<IGlobalConversation>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, default: "New Conversation" },
    messages: [
      {
        role: {
          type: String,
          enum: ["user", "assistant", "system"],
          required: true,
        },
        content: { type: String, required: true },
        files: [
          {
            name: String,
            url: String,
            type: String,
            publicId: String,
          },
        ],
        graphUpdate: { type: Schema.Types.Mixed, default: null },
        feedbackLog: { type: [String], default: null },
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
    collection: "global_conversations",
  },
);

GlobalConversationSchema.index({ userId: 1 });

const GlobalConversationModel: Model<IGlobalConversation> =
  (mongoose.models.GlobalConversation as Model<IGlobalConversation>) ||
  mongoose.model<IGlobalConversation>(
    "GlobalConversation",
    GlobalConversationSchema,
  );

export default GlobalConversationModel;
