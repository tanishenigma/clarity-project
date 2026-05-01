import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IStudentProfile extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  gender: string;
  gradeLevel: string;
  language: string;
  createdAt: Date;
  updatedAt: Date;
}

const StudentProfileSchema = new Schema<IStudentProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    gender: { type: String, default: "neutral" },
    gradeLevel: { type: String, default: "general" },
    language: { type: String, default: "english" },
  },
  {
    timestamps: true,
    collection: "student_profile",
  },
);

const StudentProfileModel: Model<IStudentProfile> =
  (mongoose.models.StudentProfile as Model<IStudentProfile>) ||
  mongoose.model<IStudentProfile>("StudentProfile", StudentProfileSchema);

export default StudentProfileModel;
