import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IChatUploadFile {
  name: string;
  url: string;
  type: string;
  publicId: string;
}

export interface IChatUpload extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  conversationId: Types.ObjectId;
  files: IChatUploadFile[];
  uploadedAt: Date;
}

const ChatUploadSchema = new Schema<IChatUpload>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "GlobalConversation",
      required: true,
    },
    files: [
      {
        name: String,
        url: String,
        type: String,
        publicId: String,
      },
    ],
    uploadedAt: { type: Date, default: Date.now },
  },
  {
    collection: "chat_uploads",
  },
);

ChatUploadSchema.index({ userId: 1, conversationId: 1 });

const ChatUploadModel: Model<IChatUpload> =
  (mongoose.models.ChatUpload as Model<IChatUpload>) ||
  mongoose.model<IChatUpload>("ChatUpload", ChatUploadSchema);

export default ChatUploadModel;
