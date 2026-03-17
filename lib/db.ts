import mongoose from "mongoose";

// Connection cache for Next.js hot-reload environments
const globalWithMongoose = global as typeof globalThis & {
  mongoose: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
  };
};

if (!globalWithMongoose.mongoose) {
  globalWithMongoose.mongoose = { conn: null, promise: null };
}

export async function connectDB(): Promise<typeof mongoose> {
  if (globalWithMongoose.mongoose.conn) {
    return globalWithMongoose.mongoose.conn;
  }

  if (!globalWithMongoose.mongoose.promise) {
    const mongoUrl = process.env.MONGODB_URI;
    if (!mongoUrl) {
      throw new Error("MONGODB_URI is not set in environment variables");
    }

    console.log("Attempting to connect to MongoDB via Mongoose...");

    globalWithMongoose.mongoose.promise = mongoose.connect(mongoUrl, {
      dbName: "ai-tutor",
      bufferCommands: false,
      maxPoolSize: 10,
      minPoolSize: 1,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
    });
  }

  try {
    globalWithMongoose.mongoose.conn =
      await globalWithMongoose.mongoose.promise;
    console.log("MongoDB connected via Mongoose successfully");
  } catch (error) {
    globalWithMongoose.mongoose.promise = null;
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Mongoose connection error:", errorMsg);
    throw new Error(`Failed to connect to MongoDB: ${errorMsg}`);
  }

  return globalWithMongoose.mongoose.conn;
}

export default connectDB;
