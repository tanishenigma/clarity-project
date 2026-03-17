import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import UserActivityModel from "@/lib/models/UserActivity";
import { startOfDay, format } from "date-fns";

/**
 * Record user activity for the heatmap calendar.
 *
 * @param userId      - MongoDB user ID string
 * @param type        - "quiz" (+1), "flashcard" (+0.5), or "study" (scaled by minutes)
 * @param dateString  - Optional "yyyy-MM-dd" override (defaults to today).
 *                      Use the study-session's date so late-night stops map correctly.
 * @param studyMinutes - Required when type === "study". Minutes studied in the session.
 *                       Scaled to heatmap units: 1 unit per 30 min studied.
 */
export async function recordActivity(
  userId: string,
  type: "quiz" | "flashcard" | "study",
  dateString?: string,
  studyMinutes?: number,
) {
  try {
    await connectDB();
    const resolvedDate =
      dateString ?? format(startOfDay(new Date()), "yyyy-MM-dd");

    let increment: number;
    if (type === "quiz") {
      increment = 1;
    } else if (type === "flashcard") {
      increment = 0.5;
    } else {
      // study: 1 heatmap unit per 30 minutes (minimum 0.5 so any session marks the day)
      increment = Math.max(0.5, Math.round((studyMinutes ?? 0) / 30));
    }

    await UserActivityModel.updateOne(
      { userId: new Types.ObjectId(userId), date: resolvedDate },
      {
        $inc: { count: increment },
        $set: { lastUpdated: new Date() },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );
  } catch (error) {
    console.error("Error recording activity:", error);
    // Don't throw, just log
  }
}

export async function getUserActivity(userId: string) {
  try {
    await connectDB();

    const activity = await UserActivityModel.find({
      userId: new Types.ObjectId(userId),
    })
      .sort({ date: -1 })
      .limit(365)
      .lean();

    return activity.map((a) => ({
      date: new Date(a.date),
      count: Math.ceil(a.count),
    }));
  } catch (error) {
    console.error("Error fetching activity:", error);
    return [];
  }
}
