import type { Types } from "mongoose";
type ObjectId = Types.ObjectId;

export interface StudySession {
  _id?: ObjectId;
  userId: ObjectId;
  startTime: Date;
  endTime?: Date;
  duration: number; // in seconds
  isActive: boolean;
  date: string; // YYYY-MM-DD format for the day this session belongs to
  createdAt: Date;
  updatedAt: Date;
}

export interface DailyStudyStats {
  _id?: ObjectId;
  userId: ObjectId;
  date: string; // YYYY-MM-DD format
  totalDuration: number; // in seconds
  sessionCount: number;
  longestSession: number; // in seconds
  resetAt: Date; // When this day started (5:30 AM)
  createdAt: Date;
  updatedAt: Date;
}

export interface GlobalTimerUser {
  userId: string;
  userName: string;
  userAvatar?: string;
  currentSessionDuration: number; // in seconds
  todayTotalDuration: number; // in seconds
  isActive: boolean;
  startTime: Date;
}

export interface StudyTimerState {
  isRunning: boolean;
  startTime?: Date;
  elapsed: number; // in seconds
  todayTotal: number; // in seconds
  sessionId?: string;
}
