import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IPodcast extends Document {
  _id: Types.ObjectId;
  contentId: Types.ObjectId;
  spaceId: Types.ObjectId;
  script: string;
  style: string;
  type?: string;
  audioUrl: string | null;
  duration: number;
  voice?: "male" | "female";
  generatedAt: Date;
  status: "script_ready" | "audio_generated" | "failed";
  audioGeneratedAt?: Date;
}

const PodcastSchema = new Schema<IPodcast>(
  {
    contentId: { type: Schema.Types.ObjectId, ref: "Content", required: true },
    spaceId: { type: Schema.Types.ObjectId, ref: "Space", required: true },
    script: { type: String, required: true },
    style: { type: String, default: "conversational" },
    type: String,
    audioUrl: { type: String, default: null },
    duration: { type: Number, default: 0 },
    voice: { type: String, enum: ["male", "female"] },
    generatedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ["script_ready", "audio_generated", "failed"],
      default: "script_ready",
    },
    audioGeneratedAt: Date,
  },
  {
    collection: "podcasts",
  },
);

PodcastSchema.index({ contentId: 1 });
PodcastSchema.index({ spaceId: 1 });

const PodcastModel: Model<IPodcast> =
  (mongoose.models.Podcast as Model<IPodcast>) ||
  mongoose.model<IPodcast>("Podcast", PodcastSchema);

export default PodcastModel;
