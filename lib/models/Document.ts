import mongoose, {
  Schema,
  Document as MongooseDocument,
  Model,
  Types,
} from "mongoose";

export interface IDocument extends MongooseDocument {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  sessionId: string;
  fileName: string;
  fileType: string;
  content: string;
  createdAt: Date;
}

const DocumentSchema = new Schema<IDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    sessionId: { type: String, required: true },
    fileName: { type: String, required: true },
    fileType: { type: String, required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  {
    collection: "documents",
  },
);

DocumentSchema.index({ userId: 1, sessionId: 1 });

const DocumentModel: Model<IDocument> =
  (mongoose.models.Document as Model<IDocument>) ||
  mongoose.model<IDocument>("Document", DocumentSchema);

export default DocumentModel;
