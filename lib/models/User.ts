import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IUser extends Document {
  _id: Types.ObjectId;
  email: string;
  username: string;
  passwordHash: string;
  authProvider: "email" | "google" | "github";
  createdAt: Date;
  theme: "light" | "dark";
  subscriptionTier: "free" | "pro" | "premium";
  studyStreak: number;
  totalStudyMinutes: number;
  apiSettings?: {
    primaryProvider: "gemini" | "openai" | "euri" | "groq" | "custom";
    apiKeys: {
      gemini?: string;
      openai?: string;
      euri?: string;
      groq?: string;
      custom?: {
        name: string;
        apiKey: string;
        endpoint: string;
      };
    };
    fallbackEnabled: boolean;
    fallbackProvider?: "gemini" | "openai" | "euri" | "groq";
    updatedAt: Date;
  };
  chatbotPersonalization?: {
    tutorName?: string;
    tone?: "friendly" | "formal" | "socratic" | "motivating";
    teachingStyle?: "concise" | "detailed" | "step-by-step" | "examples";
    customInstructions?: string;
    updatedAt?: Date;
  };
  avatar?: string;
  name?: string;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    username: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    authProvider: {
      type: String,
      enum: ["email", "google", "github"],
      default: "email",
    },
    theme: { type: String, enum: ["light", "dark"], default: "dark" },
    subscriptionTier: {
      type: String,
      enum: ["free", "pro", "premium"],
      default: "free",
    },
    studyStreak: { type: Number, default: 0 },
    totalStudyMinutes: { type: Number, default: 0 },
    apiSettings: {
      primaryProvider: {
        type: String,
        enum: ["gemini", "openai", "euri", "groq", "custom"],
      },
      apiKeys: {
        gemini: String,
        openai: String,
        euri: String,
        groq: String,
        custom: {
          name: String,
          apiKey: String,
          endpoint: String,
        },
      },
      fallbackEnabled: { type: Boolean, default: true },
      fallbackProvider: {
        type: String,
        enum: ["gemini", "openai", "euri", "groq"],
      },
      updatedAt: Date,
    },
    chatbotPersonalization: {
      tutorName: String,
      tone: {
        type: String,
        enum: ["friendly", "formal", "socratic", "motivating"],
      },
      teachingStyle: {
        type: String,
        enum: ["concise", "detailed", "step-by-step", "examples"],
      },
      customInstructions: String,
      updatedAt: Date,
    },
    avatar: String,
    name: String,
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: false },
    collection: "users",
  },
);

const UserModel: Model<IUser> =
  (mongoose.models.User as Model<IUser>) ||
  mongoose.model<IUser>("User", UserSchema);

export default UserModel;
