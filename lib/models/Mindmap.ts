import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IMindmapNode {
  id: string;
  label: string;
  type?: string;
  [key: string]: any;
}

export interface IMindmapEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  [key: string]: any;
}

export interface IMindmap extends Document {
  _id: Types.ObjectId;
  spaceId: Types.ObjectId;
  nodes: IMindmapNode[];
  edges: IMindmapEdge[];
  generatedAt: Date;
}

const MindmapSchema = new Schema<IMindmap>(
  {
    spaceId: {
      type: Schema.Types.ObjectId,
      ref: "Space",
      required: true,
      unique: true,
    },
    nodes: { type: Schema.Types.Mixed, default: [] },
    edges: { type: Schema.Types.Mixed, default: [] },
    generatedAt: { type: Date, default: Date.now },
  },
  {
    collection: "mindmaps",
  },
);

const MindmapModel: Model<IMindmap> =
  (mongoose.models.Mindmap as Model<IMindmap>) ||
  mongoose.model<IMindmap>("Mindmap", MindmapSchema);

export default MindmapModel;
