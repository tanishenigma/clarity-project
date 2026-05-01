/**
 * Learning Space Service
 * Handles database operations for learning spaces (similar to Python's supabase_service)
 */

import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { LearningSpaceModel, StudentProfileModel } from "@/lib/models";
import type { StudentProfile } from "@/lib/types";

export interface LearningSpace {
  _id?: Types.ObjectId;
  userId: Types.ObjectId | string;
  topic: string;
  pdfSource?: string | null;
  summaryNotes?: any;
  quiz?: any;
  recommendations?: any;
  mindmap?: any;
  audioScript?: string;
  audioOverview?: string;
  status: "pending" | "processing" | "completed" | "failed";
  createdAt: Date;
  updatedAt: Date;
}

export interface StudentProfileDB {
  _id?: Types.ObjectId;
  userId: Types.ObjectId | string;
  gender: string;
  gradeLevel: string;
  language: string;
  createdAt: Date;
  updatedAt: Date;
}

export class LearningSpaceService {
  private static instance: LearningSpaceService;

  static getInstance(): LearningSpaceService {
    if (!this.instance) {
      this.instance = new LearningSpaceService();
    }
    return this.instance;
  }

  /**
   * Get a learning space by ID
   */
  async getLearningSpace(spaceId: string): Promise<LearningSpace | null> {
    console.log(`[Service] Getting learning space: ${spaceId}`);
    try {
      await connectDB();
      const space = await LearningSpaceModel.findById(
        new Types.ObjectId(spaceId),
      ).lean();
      return space as any;
    } catch (error) {
      console.error(
        `[Service] Error getting learning space ${spaceId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Create a new learning space
   */
  async createLearningSpace(data: {
    userId: string | Types.ObjectId;
    topic: string;
    pdfSource?: string;
  }): Promise<LearningSpace> {
    console.log(`[Service] Creating learning space for user ${data.userId}`);
    try {
      await connectDB();

      const newSpace = await LearningSpaceModel.create({
        userId:
          typeof data.userId === "string"
            ? new Types.ObjectId(data.userId)
            : data.userId,
        topic: data.topic,
        pdfSource: data.pdfSource || null,
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      console.log(`[Service] Created space ${newSpace._id}`);
      return newSpace.toObject() as any;
    } catch (error) {
      console.error(`[Service] Error creating learning space:`, error);
      throw error;
    }
  }

  /**
   * Update a learning space with agent results
   */
  async updateLearningSpace(
    spaceId: string,
    updates: Partial<LearningSpace>,
  ): Promise<void> {
    console.log(
      `[Service] Updating space ${spaceId} with keys: ${Object.keys(updates).join(", ")}`,
    );
    try {
      await connectDB();

      const result = await LearningSpaceModel.updateOne(
        { _id: new Types.ObjectId(spaceId) },
        {
          $set: {
            ...updates,
            updatedAt: new Date(),
          },
        },
      );

      if (result.matchedCount === 0) {
        console.warn(
          `[Service] Warning: Update space ${spaceId} matched 0 documents`,
        );
      }

      console.log(`[Service] Successfully updated space ${spaceId}`);
    } catch (error) {
      console.error(`[Service] Error updating space ${spaceId}:`, error);
      throw error;
    }
  }

  /**
   * Get student profile for personalization
   */
  async getStudentProfile(
    userId: string,
  ): Promise<Pick<StudentProfile, "gender" | "gradeLevel" | "language">> {
    console.log(`[Service] Fetching profile for user ${userId}`);
    try {
      await connectDB();

      const profile = await StudentProfileModel.findOne({
        userId: new Types.ObjectId(userId),
      }).lean();

      // Return defaults if no profile exists
      if (!profile) {
        console.log(`[Service] No profile found, using defaults`);
        return {
          gender: "neutral",
          gradeLevel: "general",
          language: "english",
        };
      }

      return {
        gender: (profile as any).gender || "neutral",
        gradeLevel: (profile as any).gradeLevel || "general",
        language: (profile as any).language || "english",
      };
    } catch (error) {
      console.error(`[Service] Error fetching profile for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Upsert a student profile
   */
  async upsertStudentProfile(
    userId: string,
    profile: Partial<StudentProfileDB>,
  ): Promise<void> {
    console.log(`[Service] Upserting profile for user ${userId}`);
    try {
      await connectDB();

      await StudentProfileModel.updateOne(
        { userId: new Types.ObjectId(userId) },
        {
          $set: {
            ...profile,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            userId: new Types.ObjectId(userId),
            createdAt: new Date(),
          },
        },
        { upsert: true },
      );
      console.log(`[Service] Profile updated for user ${userId}`);
    } catch (error) {
      console.error(`[Service] Error upserting profile for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get all learning spaces for a user
   */
  async getUserLearningSpaces(userId: string): Promise<LearningSpace[]> {
    console.log(`[Service] Getting all spaces for user ${userId}`);
    try {
      await connectDB();

      const spaces = await LearningSpaceModel.find({
        userId: new Types.ObjectId(userId),
      })
        .sort({ createdAt: -1 })
        .lean();

      return spaces as any;
    } catch (error) {
      console.error(
        `[Service] Error getting spaces for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Delete a learning space
   */
  async deleteLearningSpace(spaceId: string): Promise<void> {
    console.log(`[Service] Deleting space ${spaceId}`);
    try {
      await connectDB();
      await LearningSpaceModel.deleteOne({ _id: new Types.ObjectId(spaceId) });
      console.log(`[Service] Deleted space ${spaceId}`);
    } catch (error) {
      console.error(`[Service] Error deleting space ${spaceId}:`, error);
      throw error;
    }
  }
}

export const learningSpaceService = LearningSpaceService.getInstance();
