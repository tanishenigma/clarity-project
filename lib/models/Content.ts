import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IContent extends Document {
  _id: Types.ObjectId;
  spaceId: Types.ObjectId;
  userId: Types.ObjectId;
  type: "pdf" | "image" | "audio" | "video" | "text" | "link" | "handwritten";
  title: string;
  description: string;
  source: {
    url?: string;
    fileKey: string;
    mimeType: string;
    size: number;
    cloudinaryId?: string;
    uploadedAt: Date;
  };
  processed?: {
    rawText?: string;
    transcript?: string;
    ocr?: string;
    chunks: Array<{
      id: string;
      text: string;
      chunkIndex: number;
      vectorId: string;
    }>;
    metadata: {
      extractedTopics: string[];
      difficulty: "beginner" | "intermediate" | "advanced";
      language: string;
      pageCount?: number;
      duration?: number;
    };
    processedAt: Date;
  };
  processingStatus: "pending" | "processing" | "completed" | "failed";
  processingError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ContentSchema = new Schema<IContent>(
  {
    spaceId: { type: Schema.Types.ObjectId, ref: "Space", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: ["pdf", "image", "audio", "video", "text", "link", "handwritten"],
      required: true,
    },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    source: {
      url: String,
      fileKey: { type: String, required: true },
      mimeType: { type: String, required: true },
      size: { type: Number, required: true },
      cloudinaryId: String,
      uploadedAt: { type: Date, default: Date.now },
    },
    processed: {
      rawText: String,
      transcript: String,
      ocr: String,
      chunks: [
        {
          id: String,
          text: String,
          chunkIndex: Number,
          vectorId: String,
        },
      ],
      metadata: {
        extractedTopics: [String],
        difficulty: {
          type: String,
          enum: ["beginner", "intermediate", "advanced"],
        },
        language: String,
        pageCount: Number,
        duration: Number,
      },
      processedAt: Date,
    },
    processingStatus: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },
    processingError: String,
  },
  {
    timestamps: true,
    collection: "content",
  },
);

ContentSchema.index({ spaceId: 1 });
ContentSchema.index({ userId: 1 });

const ContentModel: Model<IContent> =
  (mongoose.models.Content as Model<IContent>) ||
  mongoose.model<IContent>("Content", ContentSchema);

export default ContentModel;
