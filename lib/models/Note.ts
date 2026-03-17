import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface INote extends Document {
  _id: Types.ObjectId;
  userId: string;
  title: string;
  content: string; // HTML from rich-text editor
  createdAt: Date;
  updatedAt: Date;
}

const NoteSchema = new Schema<INote>(
  {
    userId: { type: String, required: true, index: true },
    title: { type: String, default: "Untitled" },
    content: { type: String, default: "" },
  },
  { timestamps: true },
);

const NoteModel: Model<INote> =
  mongoose.models.Note ?? mongoose.model<INote>("Note", NoteSchema);

export default NoteModel;
